// app.js — Single-file MERN backend for Sports Shop (no modular controllers/auth)
// Run: node app.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
// const dayjs = require('dayjs');

const app = express();
// app.use(cors());
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ["GET", "POST", "DELETE"],
  credentials: true
}));

app.use(express.json({ limit: '2mb' }));

/** DATE */

// PURE JS date helpers (no dayjs required)
function startOfDay(d = new Date()) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function endOfDay(d = new Date()) {
  const dt = new Date(d);
  dt.setHours(23, 59, 59, 999);
  return dt;
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function subtractDays(days = 1) {
  const dt = new Date();
  dt.setDate(dt.getDate() - days);
  return dt;
}

function subtractMonths(months = 1) {
  const dt = new Date();
  dt.setMonth(dt.getMonth() - months);
  return dt;
}





/* -------------------------- Mongo Connection -------------------------- */
const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/sports_shop';
mongoose.connect(MONGO_URL).then(() => {
  console.log('MongoDB connected:', MONGO_URL);
}).catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});


/* ------------------------------ Schemas ------------------------------ */
const { Schema, model, Types } = mongoose;

const Product = model('Product', new Schema({
  name: { type: String, required: true, index: true },
  brand: String,
  category: String,
  size: String,
  sellingPrice: { type: Number, required: true },
  costPrice: { type: Number, default: 0 },
  stockOnHand: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true }));

const Supplier = model('Supplier', new Schema({
  name: { type: String, required: true },
  phone: String,
  gstin: String,
  address: String,
  notes: String,
}, { timestamps: true }));

const Order = model('Order', new Schema({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
  quantity: { type: Number, required: true },
  status: { type: String, enum: ['PENDING', 'ORDERED', 'CANCELLED'], default: 'PENDING' },
  orderDate: { type: Date, default: Date.now },
  notes: String,
}, { timestamps: true }));

const PurchaseOrder = model('PurchaseOrder', new Schema({
  supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
  status: { type: String, enum: ['DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED'], default: 'DRAFT' },
  orderDate: { type: Date, default: Date.now },
  receivedDate: Date,
  items: [{
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    qty: { type: Number, required: true },
    unitCost: { type: Number, required: true },
    taxRate: { type: Number, default: 0 },
    total: Number,
  }],
  subTotal: Number,
  taxTotal: Number,
  grandTotal: Number,
  notes: String,
}, { timestamps: true }));

const Sale = model('Sale', new Schema({
  saleDate: { type: Date, default: Date.now },
  items: [{
    product: { type: Schema.Types.ObjectId, ref: "Product" },
    qty: Number,
    sellingPrice: Number,
    costPrice: Number,
    lineTotal: Number
  }],
  paymentMethod: { type: String, enum: ['CASH', 'UPI', 'CARD', 'OTHER'], default: 'CASH' },
  notes: String,
  subTotal: Number,
  taxTotal: Number,
  grandTotal: Number,
}, { timestamps: true }));

const Exchange = model('Exchange', new Schema({
  exchangeDate: { type: Date, default: Date.now },
  returnedItems: [{ product: { type: Schema.Types.ObjectId, ref: 'Product', required: true }, qty: { type: Number, required: true } }],
  issuedItems:   [{ product: { type: Schema.Types.ObjectId, ref: 'Product', required: true }, qty: { type: Number, required: true } }],
  differencePaid: { type: Number, default: 0 }, // + customer pays; - you refund
  notes: String,
}, { timestamps: true }));

const Expense = model('Expense', new Schema({
  date: { type: Date, default: Date.now },
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['CASH', 'UPI', 'CARD', 'BANK'], default: 'CASH' },
  notes: String,
}, { timestamps: true }));

const StockTxn = model('StockTxn', new Schema({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  qtyChange: { type: Number, required: true }, // + receive/return ; - sale/issue
  reason: { type: String, enum: ['PO_RECEIVE', 'SALE', 'EXCHANGE_RETURN', 'EXCHANGE_ISSUE', 'MANUAL_ADJUST'], required: true },
  refType: String,
  refId: Schema.Types.ObjectId,
  at: { type: Date, default: Date.now },
}, { timestamps: true }));


/* =============================== ROUTES ============================== */
/* ------------------------------ Products ----------------------------- */
// Create
app.post('/api/products', async (req, res) => {
  try {
    const p = await Product.create(req.body);
    res.status(201).json(p);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
// List (basic filters)
app.get('/api/products', async (req, res) => {
  try {
    const { q, lowStock } = req.query;
    const where = {};
    if (q) where.name = { $regex: q, $options: 'i' };
    if (lowStock === '1') where.$expr = { $lte: ['$stockOnHand', '$reorderLevel'] };
    const data = await Product.find(where).sort({ name: 1 }).limit(500);
    res.json(data);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
// Get one
app.get('/api/products/:id', async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json(p);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
// Update
app.put('/api/products/:id', async (req, res) => {
  try {
    const p = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(p);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
// Delete
app.delete('/api/products/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Low stock list
app.get('/api/reports/low-stock', async (req, res) => {

  const products = await Product.find({
    stockOnHand: { $lt: 5 }   // threshold
  }).limit(10);
  res.json(products);

});

/* ------------------------------ Suppliers ---------------------------- */
app.post('/api/suppliers', async (req, res) => {
  try { res.status(201).json(await Supplier.create(req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.get('/api/suppliers', async (_req, res) => {
  try { res.json(await Supplier.find({}).sort({ name: 1 }).limit(500)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.put('/api/suppliers/:id', async (req, res) => {
  try { res.json(await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true })); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete('/api/suppliers/:id', async (req, res) => {
  try { await Supplier.findByIdAndDelete(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

/* ---------------------------- Purchase Orders ------------------------ */
// Create PO (DRAFT/ORDERED)
app.post('/api/purchase-orders', async (req, res) => {
  try {
    const po = req.body;
    let sub = 0, tax = 0;
    (po.items || []).forEach(it => {
      const net = (it.unitCost || 0) * (it.qty || 0);
      const t = (it.taxRate || 0) * net;
      // it.total = rupee(net + t);
      it.total = net + t;
      sub += net; tax += t;
    });
    const doc = await PurchaseOrder.create({
      supplier: po.supplier,
      status: po.status || 'ORDERED',
      orderDate: po.orderDate || new Date(),
      items: po.items,
      subTotal: sub,
      taxTotal: tax,
      grandTotal: sub + tax,
      notes: po.notes
    });
    res.status(201).json(doc);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// List POs
app.get('/api/purchase-orders', async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;
    const pos = await PurchaseOrder.find(where)
      .populate('supplier')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(pos);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Receive PO (apply weighted avg cost + stock)
app.post('/api/purchase-orders/:id/receive', async (req, res) => {
  // const session = await mongoose.startSession();
  // session.startTransaction();
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) throw new Error('PO not found');
    if (po.status === 'RECEIVED') throw new Error('PO already received');
    for (const it of po.items) {
      const p = await Product.findById(it.product);
      if (!p) throw new Error('Product missing for PO item');
      const stock = Math.max(0, p.stockOnHand || 0);
      const qty = it.qty || 0;
      const cost = it.unitCost || 0;
      const newQty = stock + qty;
      const newCost = newQty > 0 ? ((p.costPrice * stock) + (cost * qty)) / newQty : p.costPrice;
      p.costPrice = newCost;
      p.stockOnHand = newQty;
      await p.save();
      await StockTxn.create([{
        product: p._id, qtyChange: qty, reason: 'PO_RECEIVE',
        refType: 'PurchaseOrder', refId: po._id, at: new Date()
      }]);
    }
    po.status = 'RECEIVED';
    po.receivedDate = new Date();
    await po.save();
    // await po.save({ session });
    // await session.commitTransaction();
    // session.endSession();
    res.json(po);
  } catch (e) {
    // await session.abortTransaction(); session.endSession();
    res.status(400).json({ error: e.message });
  }
});

/* --------------------------------- Sales ----------------------------- */
// Create Sale (snapshot COGS, reduce stock, compute totals)
app.post("/api/sales", async (req, res) => {
  try {

    const { saleDate, items, paymentMethod } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ error: "No sale items provided" });
    }

    const processedItems = [];

    for (const line of items) {

      const product = await Product.findById(line.product);

      if (!product) {
        return res.status(400).json({ error: "Product not found" });
      }

      if (product.stockOnHand < line.qty) {
        return res.status(400).json({
          error: `Insufficient stock for ${product.name}`
        });
      }

      const lineTotal = line.qty * line.sellingPrice;

      processedItems.push({
        product: product._id,
        qty: line.qty,
        sellingPrice: line.sellingPrice,
        costPrice: product.costPrice,
        lineTotal
      });

      // reduce stock
      product.stockOnHand -= line.qty;
      await product.save();
    }

    const sale = await Sale.create({
      saleDate: saleDate || new Date(),
      items: processedItems,
      paymentMethod
    });

    res.json(sale);

  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// List Sales (date range optional)
app.get('/api/reports/sales-by-payment', async (req, res) => {
  try {
    const { groupBy = 'day', from, to } = req.query;
    const start = from ? new Date(from) : subtractDays(7);
    const end = to ? new Date(to) : new Date();

    const truncUnit = groupBy === 'month' ? 'month' :
                      groupBy === 'week' ? 'week' : 'day';

    const rows = await Sale.aggregate([
      { $match: { saleDate: { $gte: start, $lte: end } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: { date: { $dateTrunc: { date: '$saleDate', unit: truncUnit } }, paymentMethod: '$paymentMethod' },
          sales: { $sum: '$items.lineTotal' },
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    res.json(rows.map(r => ({
      period: r._id.date,
      paymentMethod: r._id.paymentMethod,
      sales: r.sales
    })));

  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/sale/weekly-sales", async (req, res) => {

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const sales = await Sale.find({
    saleDate: { $gte: sevenDaysAgo }
  }).populate("items.product");

  const result = [];

  sales.forEach(s => {
    s.items.forEach(i => {

      if (!i.product) return;

      result.push({
        name: i.product.name,
        costPrice: i.product.costPrice,
        sellingPrice: i.sellingPrice,
        qty: i.qty,
        total: i.qty * i.sellingPrice
      });

    });
  });

  res.json(result);
});

// routes/sales.js or your main server file
app.get('/api/sales/payment-summary', async (_req, res) => {
  try {
    const now = new Date();

    // Helper function to get start of day/week/month
    const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const startOfWeek = d => {
      const day = d.getDay(); // 0=Sun
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Mon as start
      return new Date(d.getFullYear(), d.getMonth(), diff);
    };
    const startOfMonth = d => new Date(d.getFullYear(), d.getMonth(), 1);

    const periods = {
      day: { start: startOfDay(now), end: now },
      week: { start: startOfWeek(now), end: now },
      month: { start: startOfMonth(now), end: now },
    };

    const result = {};

    for (const [key, { start, end }] of Object.entries(periods)) {
      const agg = await Sale.aggregate([
        { $match: { saleDate: { $gte: start, $lte: end } } },
        { $group: { 
            _id: '$paymentMethod',
            total: { $sum: { $sum: '$items.lineTotal' } } 
        } }
      ]);

      // Initialize with 0 for all methods
      result[key] = { CASH: 0, UPI: 0};
      agg.forEach(a => { result[key][a._id] = a.total; });
    }

    res.json(result);

  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});


/* ------------------------------- Exchanges --------------------------- */
app.post('/api/exchanges', async (req, res) => {
  // const session = await mongoose.startSession();
  // session.startTransaction();
  try {
    const { exchangeDate, returnedItems = [], issuedItems = [], notes } = req.body;

    // Compute totals (based on current sellingPrice for reference; you can pass explicit prices if needed)
    const getTotal = async (arr) => {
      let total = 0;
      for (const l of arr) {
        const p = await Product.findById(l.product);
        if (!p) throw new Error('Product not found in exchange');
        total += (p.sellingPrice || 0) * (l.qty || 0);
      }
      return total;
    };

    // Stock adjustments: return -> +qty, issue -> -qty
    for (const r of returnedItems) {
      const p = await Product.findById(r.product);
      p.stockOnHand = (p.stockOnHand || 0) + (r.qty || 0);
      await p.save();
      await StockTxn.create([{
        product: p._id, qtyChange: (r.qty || 0), reason: 'EXCHANGE_RETURN',
        refType: 'Exchange', at: new Date()
      }]);
    }
    for (const i of issuedItems) {
      const p = await Product.findById(i.product);
      if ((p.stockOnHand || 0) < (i.qty || 0)) throw new Error(`Insufficient stock for ${p.name}`);
      p.stockOnHand = (p.stockOnHand || 0) - (i.qty || 0);
      await p.save();
      await StockTxn.create([{
        product: p._id, qtyChange: -(i.qty || 0), reason: 'EXCHANGE_ISSUE',
        refType: 'Exchange', at: new Date()
      }]);
    }

    const totalReturned = await getTotal(returnedItems);
    const totalIssued = await getTotal(issuedItems);
    const differencePaid = (totalIssued - totalReturned);

    const ex = await Exchange.create([{
      exchangeDate: exchangeDate || new Date(),
      returnedItems, issuedItems, differencePaid, notes
    }]);

    // await session.commitTransaction(); session.endSession();
    res.status(201).json(ex[0]);
  } catch (e) {
    // await session.abortTransaction(); session.endSession();
    res.status(400).json({ error: e.message });
  }
});

// Recent Exchanges
app.get('/api/exchanges', async (_req, res) => {
  try {
    const list = await Exchange.find({})
      .populate("returnedItems.product")
      .populate("issuedItems.product")
      .sort({ exchangeDate: -1 })
      .limit(50);

    res.json(list);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/* -------------------------------- Expenses --------------------------- */
app.post('/api/expenses', async (req, res) => {
  try { res.status(201).json(await Expense.create(req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.get('/api/expenses', async (req, res) => {
  try {
    const { from, to } = req.query;
    const where = {};
    if (from || to) {
      where.date = {};
      if (from) where.date.$gte = new Date(from);
      if (to) where.date.$lte = new Date(to);
    }
    res.json(await Expense.find(where).sort({ date: -1 }).limit(500));
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete('/api/expenses/:id', async (req, res) => {
  try { await Expense.findByIdAndDelete(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

/* -------------------------------- Reports ---------------------------- */
// Dashboard summary: today sales/profit, monthly sales, product count
app.get('/api/reports/summary', async (_req, res) => {
  try {
    const todayStart = startOfDay();
    const todayEnd = endOfDay();
    const monthStart = startOfMonth();
    const monthEnd = endOfMonth();

    const todaySales = await Sale.aggregate([
      { $match: { saleDate: { $gte: todayStart, $lte: todayEnd } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          sales: { $sum: "$items.lineTotal" },
          profit: {
            $sum: {
              $multiply: [
                "$items.qty",
                { $subtract: ["$items.sellingPrice", "$items.costPrice"] }
              ]
            }
          }
        }
      }
    ]);

    const monthSales = await Sale.aggregate([
      { $match: { saleDate: { $gte: monthStart, $lte: monthEnd } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          sales: { $sum: "$items.lineTotal" }
        }
      }
    ]);

    const productCount = await Product.countDocuments({});

    res.json({
      todaySales: todaySales[0]?.sales || 0,
      todayProfit: todaySales[0]?.profit || 0,
      monthlySales: monthSales[0]?.sales || 0,
      productCount
    });

  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Daily sales report (last N days; default 7)
app.get('/api/reports/daily', async (req, res) => {
  try {

    const days = Number(req.query.days || 7);
    const since = startOfDay(subtractDays(days - 1));

    const rows = await Sale.aggregate([
      { $match: { saleDate: { $gte: since } } },
      { $unwind: '$items' },

      {
        $group: {
          _id: { $dateTrunc: { date: '$saleDate', unit: 'day' } },

          sales: { $sum: '$items.lineTotal' },

          profit: {
            $sum: {
              $multiply: [
                '$items.qty',
                { $subtract: ['$items.sellingPrice', '$items.costPrice'] }
              ]
            }
          }

        }
      },

      { $sort: { _id: 1 } }

    ]);

    res.json(rows);

  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Weekly or Monthly (groupBy=week|month, from/to optional)
app.get('/api/reports/aggregate', async (req, res) => {
  try {
    const { groupBy = 'week', from, to } = req.query;
    const start = from ? new Date(from) : subtractMonths(6);
    const end = to ? new Date(to) : new Date();

    const trunc = groupBy === 'month'
      ? { $dateTrunc: { date: '$saleDate', unit: 'month' } }
      : { $dateTrunc: { date: '$saleDate', unit: 'week' } };

    const rows = await Sale.aggregate([
      { $match: { saleDate: { $gte: start, $lte: end } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: trunc,
          sales: { $sum: '$items.lineTotal' },
          profit: {
            $sum: {
              $multiply: [
                '$items.qty',
                { $subtract: ['$items.sellingPrice', '$items.costPrice'] }
              ]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json(rows.map(r => ({ period: r._id, sales: r.sales, profit: r.profit })));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Top suppliers (last 90 days by purchase total)
app.get('/api/reports/top-suppliers', async (_req, res) => {
  try {
    // Get 5 suppliers from the database
    const suppliers = await Supplier.find({})
      .sort({ name: 1 })  // optional alphabetical
      .limit(5)
      .lean();

    // Optionally, include total purchase if you want
    const supplierIds = suppliers.map(s => s._id);

    const totals = await PurchaseOrder.aggregate([
      { $match: { supplier: { $in: supplierIds }, status: 'RECEIVED' } },
      { $group: { _id: '$supplier', total: { $sum: '$grandTotal' } } }
    ]);

    // Merge totals with suppliers
    const result = suppliers.map(s => {
      const t = totals.find(x => x._id.toString() === s._id.toString());
      return {
        supplier: s,
        total: t ? t.total : 0
      };
    });

    res.json(result);

  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/* ------------------------------- Utilities --------------------------- */
// Manual stock adjust (if you ever need it)
app.post('/api/products/:id/adjust', async (req, res) => {
  try {
    const { delta, reason = 'MANUAL_ADJUST' } = req.body;
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Product not found' });
    p.stockOnHand = (p.stockOnHand || 0) + Number(delta || 0);
    await p.save();
    await StockTxn.create({ product: p._id, qtyChange: Number(delta || 0), reason, refType: 'Manual', at: new Date() });
    res.json(p);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/*--------------Order of Product from Supplier Keep track of what i need to buy */

// List all pending orders
// GET /api/orders
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find({})
      .populate('product', 'name brand stockOnHand')   // populate product name, brand, stock
      .populate('supplier', 'name address');           // populate supplier name, address
    res.json(orders);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Create a new planned order
app.post('/api/orders', async (req, res) => {
  const { product, supplier, quantity, notes } = req.body;
  const order = await Order.create({ product, supplier, quantity, notes });
  res.status(201).json(order);
});

// Delete / cancel a planned order
app.delete('/api/orders/:id', async (req, res) => {
  await Order.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});


// Health
app.get('/health', (_req, res) => res.json({ ok: true, now: new Date() }));

/* ------------------------------- Startup ----------------------------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));