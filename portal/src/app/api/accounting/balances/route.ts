import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { connectToDatabase } from '@/lib/db';
import { Transaction } from '@/models/Transaction';
import { Statement } from '@/models/Statement';
import { Category } from '@/models/Category';
import { Account } from '@/models/Account';
import { Types } from 'mongoose';
import dayjs from 'dayjs';

// Helper function to get or create reconciliation category
async function getOrCreateReconciliationCategory(): Promise<Types.ObjectId> {
  let category = await Category.findOne({ name: 'Reconciliation', type: 'income' });
  
  if (!category) {
    category = await Category.create({
      name: 'Reconciliation',
      type: 'income', // Can be either income or expense depending on direction
      description: 'Balance reconciliation adjustments',
      isSystem: true,
      isDeductible: false,
      status: 'active',
    });
  }
  
  return category._id;
}

// Helper function to get company from statement
async function getCompanyFromStatement(statement: any): Promise<Types.ObjectId | null> {
  if (statement.account && statement.account.company) {
    return statement.account.company;
  }
  
  if (statement.accountName) {
    const account = await Account.findOne({ name: statement.accountName }).lean();
    if (account && account.company) {
      return account.company as Types.ObjectId;
    }
  }
  
  return null;
}

// GET: Fetch account balances and balance history
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const accountName = searchParams.get('account');
    const includeHistory = searchParams.get('includeHistory') === 'true';
    const historyDays = parseInt(searchParams.get('historyDays') || '30');

    // Get latest balance for each account
    const latestBalances = await Transaction.aggregate([
      {
        $lookup: {
          from: 'statements',
          localField: 'statement',
          foreignField: '_id',
          as: 'statementInfo',
        },
      },
      {
        $unwind: '$statementInfo',
      },
      // Filter by account if specified
      ...(accountName ? [{ $match: { 'statementInfo.accountName': accountName } }] : []),
      // Sort by date to get latest
      {
        $sort: { txnDate: -1, createdAt: -1 },
      },
      // Group by account to get latest transaction
      {
        $group: {
          _id: '$statementInfo.accountName',
          currentBalance: { $first: '$balance' },
          lastTransactionDate: { $first: '$txnDate' },
          lastTransactionDesc: { $first: '$description' },
          lastTransactionAmount: { $first: '$amount' },
          lastTransactionDirection: { $first: '$direction' },
          bankName: { $first: '$statementInfo.bankName' },
          currency: { $first: '$statementInfo.currency' },
          totalTransactions: { $sum: 1 },
        },
      },
      {
        $project: {
          accountName: '$_id',
          currentBalance: 1,
          lastTransaction: {
            date: '$lastTransactionDate',
            description: '$lastTransactionDesc',
            amount: '$lastTransactionAmount',
            direction: '$lastTransactionDirection',
          },
          bankName: 1,
          currency: 1,
          totalTransactions: 1,
          _id: 0,
        },
      },
      {
        $sort: { accountName: 1 },
      },
    ]);

    // Calculate account statistics
    const accountStats = await Transaction.aggregate([
      {
        $lookup: {
          from: 'statements',
          localField: 'statement',
          foreignField: '_id',
          as: 'statementInfo',
        },
      },
      {
        $unwind: '$statementInfo',
      },
      ...(accountName ? [{ $match: { 'statementInfo.accountName': accountName } }] : []),
      {
        $group: {
          _id: {
            account: '$statementInfo.accountName',
            direction: '$direction',
          },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' },
        },
      },
      {
        $group: {
          _id: '$_id.account',
          stats: {
            $push: {
              direction: '$_id.direction',
              totalAmount: '$totalAmount',
              count: '$count',
              avgAmount: '$avgAmount',
            },
          },
        },
      },
    ]);

    // Merge balance and stats data
    const accountsData = latestBalances.map(account => {
      const stats = accountStats.find(s => s._id === account.accountName);
      const debitStats = stats?.stats.find((s: any) => s.direction === 'debit');
      const creditStats = stats?.stats.find((s: any) => s.direction === 'credit');

      return {
        ...account,
        statistics: {
          totalDebits: debitStats?.totalAmount || 0,
          totalCredits: creditStats?.totalAmount || 0,
          debitCount: debitStats?.count || 0,
          creditCount: creditStats?.count || 0,
          avgDebitAmount: debitStats?.avgAmount || 0,
          avgCreditAmount: creditStats?.avgAmount || 0,
          netFlow: (creditStats?.totalAmount || 0) - (debitStats?.totalAmount || 0),
        },
      };
    });

    // Get balance history if requested
    let balanceHistory = null;
    if (includeHistory) {
      const historyStartDate = dayjs().subtract(historyDays, 'days').toDate();
      
      const historyData = await Transaction.aggregate([
        {
          $match: {
            txnDate: { $gte: historyStartDate },
            balance: { $ne: null },
          },
        },
        {
          $lookup: {
            from: 'statements',
            localField: 'statement',
            foreignField: '_id',
            as: 'statementInfo',
          },
        },
        {
          $unwind: '$statementInfo',
        },
        ...(accountName ? [{ $match: { 'statementInfo.accountName': accountName } }] : []),
        {
          $sort: { txnDate: 1 },
        },
        {
          $group: {
            _id: {
              account: '$statementInfo.accountName',
              date: { $dateToString: { format: '%Y-%m-%d', date: '$txnDate' } },
            },
            endingBalance: { $last: '$balance' },
            transactions: { $sum: 1 },
            debits: {
              $sum: {
                $cond: [{ $eq: ['$direction', 'debit'] }, '$amount', 0],
              },
            },
            credits: {
              $sum: {
                $cond: [{ $eq: ['$direction', 'credit'] }, '$amount', 0],
              },
            },
          },
        },
        {
          $sort: {
            '_id.account': 1,
            '_id.date': 1,
          },
        },
        {
          $group: {
            _id: '$_id.account',
            history: {
              $push: {
                date: '$_id.date',
                balance: '$endingBalance',
                transactions: '$transactions',
                debits: '$debits',
                credits: '$credits',
                netChange: { $subtract: ['$credits', '$debits'] },
              },
            },
          },
        },
      ]);

      // Format history data
      balanceHistory = {};
      historyData.forEach(item => {
        balanceHistory[item._id] = item.history;
      });
    }

    // Get recent balance changes (last 5 transactions with balance changes)
    const recentChanges = await Transaction.aggregate([
      {
        $match: {
          balance: { $ne: null },
        },
      },
      {
        $lookup: {
          from: 'statements',
          localField: 'statement',
          foreignField: '_id',
          as: 'statementInfo',
        },
      },
      {
        $unwind: '$statementInfo',
      },
      ...(accountName ? [{ $match: { 'statementInfo.accountName': accountName } }] : []),
      {
        $sort: { txnDate: -1 },
      },
      {
        $limit: accountName ? 20 : 5, // More details for specific account
      },
      {
        $project: {
          account: '$statementInfo.accountName',
          date: '$txnDate',
          description: '$description',
          amount: '$amount',
          direction: '$direction',
          balance: '$balance',
          checkNo: '$checkNo',
        },
      },
    ]);

    // Calculate balance trends
    const trends = accountsData.map(account => {
      const thirtyDaysAgo = dayjs().subtract(30, 'days').toDate();
      const sevenDaysAgo = dayjs().subtract(7, 'days').toDate();
      
      return {
        accountName: account.accountName,
        currentBalance: account.currentBalance,
        trend: {
          // This would need historical balance data to calculate properly
          // For now, we'll use transaction flow as a proxy
          last30Days: account.statistics.netFlow,
          last7Days: 0, // Would need to calculate from recent transactions
          direction: account.statistics.netFlow >= 0 ? 'up' : 'down',
          percentage: 0, // Would need historical data to calculate
        },
      };
    });

    return NextResponse.json({
      success: true,
      accounts: accountsData,
      balanceHistory: includeHistory ? balanceHistory : undefined,
      recentChanges,
      trends,
      summary: {
        totalAccounts: accountsData.length,
        totalBalance: accountsData.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0),
        lastUpdated: accountsData.reduce((latest, acc) => {
          const accDate = acc.lastTransaction?.date ? new Date(acc.lastTransaction.date) : new Date(0);
          return accDate > latest ? accDate : latest;
        }, new Date(0)),
      },
    });

  } catch (error: any) {
    console.error('Error fetching account balances:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch account balances', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// POST: Reconcile account balance
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const body = await request.json();
    const { accountName, actualBalance, reconcileDate, notes } = body;

    if (!accountName || actualBalance === undefined) {
      return NextResponse.json(
        { error: 'Account name and actual balance are required' },
        { status: 400 }
      );
    }

    // Get the latest transaction for this account with statement populated
    const latestTransaction = await Transaction.findOne()
      .populate({
        path: 'statement',
        match: { accountName },
        populate: { path: 'account' }
      })
      .sort({ txnDate: -1 })
      .exec();

    if (!latestTransaction || !latestTransaction.statement) {
      return NextResponse.json(
        { error: 'No transactions found for this account' },
        { status: 404 }
      );
    }

    const currentBalance = latestTransaction.balance || 0;
    const difference = actualBalance - currentBalance;

    // Create reconciliation transaction if there's a difference
    if (Math.abs(difference) > 0.01) { // Allow for small rounding differences
      // Get or create reconciliation category
      const reconciliationCategoryId = await getOrCreateReconciliationCategory();
      
      // Get company from statement
      const companyId = await getCompanyFromStatement(latestTransaction.statement);
      
      const transactionData: any = {
        statement: latestTransaction.statement._id || latestTransaction.statement,
        txnDate: reconcileDate || new Date(),
        description: `Balance Reconciliation${notes ? `: ${notes}` : ''}`,
        amount: Math.abs(difference),
        direction: difference > 0 ? 'credit' : 'debit',
        balance: actualBalance,
        category: reconciliationCategoryId,
        confidence: 1,
        taxDeductible: false,
      };
      
      // Add company if available
      if (companyId) {
        transactionData.company = companyId;
      }
      
      const reconciliationTxn = await Transaction.create(transactionData);

      return NextResponse.json({
        success: true,
        reconciled: true,
        transaction: reconciliationTxn,
        previousBalance: currentBalance,
        newBalance: actualBalance,
        adjustment: difference,
      });
    }

    return NextResponse.json({
      success: true,
      reconciled: false,
      message: 'Balance is already correct',
      currentBalance,
    });

  } catch (error: any) {
    console.error('Error reconciling balance:', error);
    return NextResponse.json(
      {
        error: 'Failed to reconcile balance',
        details: error.message
      },
      { status: 500 }
    );
  }
}