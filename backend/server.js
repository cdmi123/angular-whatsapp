const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const multer = require('multer');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const mongoose = require('mongoose');

// Models
const Category = require('./models/Category');
const Contact = require('./models/Contact');
const Stats = require('./models/Stats');
const Campaign = require('./models/Campaign');

let activeCampaign = null;
let currentStats = { sentCount: 0, receivedCount: 0, readCount: 0 };

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/whatsapp_db')
  .then(async () => {
      console.log('MongoDB Connected successfully.');
      let stats = await Stats.findOne();
      if (!stats) {
          stats = new Stats();
          await stats.save();
      }
      currentStats = stats;
  })
  .catch(err => console.error('MongoDB Connection Error:', err));

const upload = multer({ dest: 'uploads/' });

// Provide the system chrome path if puppeteer wasn't downloaded
const executablePath = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe') 
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : fs.existsSync('C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe')
    ? 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    : undefined;

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
    }
});

let isClientReady = false;

client.on('qr', async (qr) => {
    console.log('QR RECEIVED');
    try {
        const qrCodeDataUrl = await qrcode.toDataURL(qr);
        io.emit('qr', qrCodeDataUrl);
    } catch (err) {
        console.error('Error generating QR code', err);
    }
});

client.on('ready', () => {
    console.log('WhatsApp Client is ready!');
    isClientReady = true;
    io.emit('ready', { status: 'WhatsApp Client is ready!' });
});

client.on('authenticated', () => {
    console.log('AUTHENTICATED');
    io.emit('authenticated', { status: 'Authenticated!' });
});

client.on('auth_failure', msg => {
    console.error('AUTHENTICATION FAILURE', msg);
    io.emit('auth_failure', { status: 'Authentication failure!' });
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
    isClientReady = false;
    io.emit('disconnected', { status: 'Client was logged out!' });
});

client.initialize();

client.on('message', async msg => {
    if(msg.from !== 'status@broadcast') {
        currentStats.receivedCount++;
        io.emit('stats_update', currentStats);
        Stats.updateOne({}, { $inc: { receivedCount: 1 } }).catch(e => console.error(e));

        // Attempt to attribute to recent campaign
        const phone = msg.from.split('@')[0];
        const recentCampaign = await Campaign.findOne({
            'contacts.phone': { $regex: new RegExp(phone + '$') },
            createdAt: { $gt: new Date(Date.now() - 48 * 60 * 60 * 1000) } // Last 48 hours
        }).sort({ createdAt: -1 });

        if (recentCampaign) {
            await Campaign.updateOne(
                { _id: recentCampaign._id, 'contacts.phone': { $regex: new RegExp(phone + '$') } },
                { 
                    $inc: { receivedCount: 1 },
                    $set: { 'contacts.$.status': 'received', 'contacts.$.lastInteraction': new Date() }
                }
            );
            io.emit('campaign_stats_update', { campaignId: recentCampaign._id });
        }
    }
});

client.on('message_ack', async (msg, ack) => {
    // ack: 1=Send, 2=Received, 3=Read
    if(ack === 3) {
        currentStats.readCount++;
        io.emit('stats_update', currentStats);
        Stats.updateOne({}, { $inc: { readCount: 1 } }).catch(e => console.error(e));

        const phone = msg.to.split('@')[0];
        const recentCampaign = await Campaign.findOne({
            'contacts.phone': { $regex: new RegExp(phone + '$') },
            createdAt: { $gt: new Date(Date.now() - 72 * 60 * 60 * 1000) } // Last 72 hours
        }).sort({ createdAt: -1 });

        if (recentCampaign) {
            await Campaign.updateOne(
                { _id: recentCampaign._id, 'contacts.phone': { $regex: new RegExp(phone + '$') }, 'contacts.status': { $ne: 'read' } },
                { 
                    $inc: { readCount: 1 },
                    $set: { 'contacts.$.status': 'read' }
                }
            );
            io.emit('campaign_stats_update', { campaignId: recentCampaign._id });
        }
    }
});

io.on('connection', (socket) => {
    console.log('A user connected via socket.io');
    if (isClientReady) {
        socket.emit('ready', { status: 'WhatsApp Client is ready!' });
    }
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

app.get('/api/status', (req, res) => {
    res.json({ ready: isClientReady });
});

app.get('/api/stats', (req, res) => {
    // Sanity check: Read/Received shouldn't exceed Sent (usually)
    if (currentStats.readCount > currentStats.sentCount) {
        currentStats.readCount = currentStats.sentCount;
    }
    res.json({
        stats: currentStats,
        activeCampaign: activeCampaign
    });
});

// ==========================================
// CATEGORY CRUD
// ==========================================
app.post('/api/categories', async (req, res) => {
    try {
        const { name, description } = req.body;
        const newCategory = new Category({ name, description });
        await newCategory.save();
        res.status(201).json(newCategory);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.get('/api/categories', async (req, res) => {
    try {
        // Fetch categories and counts
        const categories = await Category.find().sort({ createdAt: -1 }).lean();
        
        // Add contact count for each category
        for(let i = 0; i < categories.length; i++) {
            categories[i].contactCount = await Contact.countDocuments({ categoryId: categories[i]._id });
        }
        
        res.json(categories);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/categories/:id', async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        // Also delete associated contacts
        await Contact.deleteMany({ categoryId: req.params.id });
        res.json({ success: true, message: 'Category deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// CONTACT CRUD
// ==========================================
app.post('/api/contacts', async (req, res) => {
    try {
        const { name, phone, categoryId } = req.body;
        const newContact = new Contact({ name, phone, categoryId });
        await newContact.save();
        res.status(201).json(newContact);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.get('/api/contacts/category/:categoryId', async (req, res) => {
    try {
        const contacts = await Contact.find({ categoryId: req.params.categoryId }).sort({ createdAt: -1 });
        res.json(contacts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/contacts/:id', async (req, res) => {
    try {
        const { name, phone } = req.body;
        const updatedContact = await Contact.findByIdAndUpdate(req.params.id, { name, phone }, { new: true });
        res.json(updatedContact);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/contacts/:id', async (req, res) => {
    try {
        await Contact.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Contact deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// CAMPAIGN HISTORY
// ==========================================
app.get('/api/campaigns', async (req, res) => {
    try {
        const campaigns = await Campaign.find().sort({ createdAt: -1 }).limit(20);
        console.log(`Campaign history fetch: found ${campaigns.length} campaigns`);
        res.json(campaigns);
    } catch (err) {
        console.error('Campaign fetch error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/debug/db', async (req, res) => {
    try {
        const count = await Campaign.countDocuments();
        const all = await Campaign.find().select('name createdAt status').limit(50);
        res.json({ count, campaigns: all });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/campaigns/:id', async (req, res) => {
    try {
        const campaign = await Campaign.findById(req.params.id);
        res.json(campaign);
    } catch (err) {
        res.status(404).json({ error: 'Campaign not found' });
    }
});

app.delete('/api/campaigns/:id', async (req, res) => {
    try {
        await Campaign.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Campaign deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/campaigns/:id/export', async (req, res) => {
    try {
        const campaign = await Campaign.findById(req.params.id);
        if (!campaign) return res.status(404).send('Campaign not found');

        let csv = 'Phone,Name,Status,Error\n';
        campaign.contacts.forEach(c => {
            csv += `${c.phone},${c.name || ''},${c.status},${c.error || ''}\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=campaign_${req.params.id}.csv`);
        res.status(200).send(csv);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post('/api/campaigns/:id/retry', async (req, res) => {
    try {
        const campaign = await Campaign.findById(req.params.id);
        if (!campaign || !isClientReady) return res.status(400).json({ error: 'Campaign not found or client not ready' });

        const failedContacts = campaign.contacts.filter(c => c.status === 'failed');
        if (failedContacts.length === 0) return res.json({ message: 'No failed contacts to retry' });

        res.json({ success: true, message: `Retrying ${failedContacts.length} contacts` });

        // Run retry in background
        (async () => {
            for (const contact of failedContacts) {
                let cleanNum = contact.phone.replace(/\D/g, '');
                if (cleanNum.length === 10) cleanNum = '91' + cleanNum;
                const formattedNumber = `${cleanNum}@c.us`;

                try {
                    await sleep(1000 + Math.random() * 2000);
                    await client.sendMessage(formattedNumber, campaign.message);
                    
                    await Campaign.updateOne(
                        { _id: campaign._id, 'contacts.phone': contact.phone },
                        { $set: { 'contacts.$.status': 'sent', 'contacts.$.error': '' }, $inc: { sentCount: 1, failedCount: -1 } }
                    );
                } catch (error) {
                    await Campaign.updateOne(
                        { _id: campaign._id, 'contacts.phone': contact.phone },
                        { $set: { 'contacts.$.error': error.message } }
                    );
                }
            }
            io.emit('campaign_stats_update', { campaignId: campaign._id });
        })();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// BULK SENDING
// ==========================================
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.post('/api/send-bulk', upload.single('csvFile'), async (req, res) => {
    if (!isClientReady) {
        return res.status(400).json({ success: false, message: 'WhatsApp client is not ready. Please scan the QR code.' });
    }

    const { message, category, categoryId } = req.body;
    let numbers = [];

    // 1. Fetch from Database if CategoryId is provided
    if (categoryId) {
        try {
            const contacts = await Contact.find({ categoryId });
            contacts.forEach(c => numbers.push(c.phone));
        } catch (err) {
            console.error("Error fetching contacts for category", err);
        }
    }

    // 2. Fetch from manual text area
    if (req.body.numbers) {
        const manualNumbers = req.body.numbers.split('\n').map(n => n.trim()).filter(n => n);
        numbers = [...numbers, ...manualNumbers];
    }

    // 3. Fetch from CSV
    if (req.file) {
        try {
            const results = [];
            await new Promise((resolve, reject) => {
                fs.createReadStream(req.file.path)
                  .pipe(csv())
                  .on('data', (data) => {
                      const phone = data.phone || data.number || data.Phone || data.Number || Object.values(data)[0];
                      if (phone) results.push(phone.trim());
                  })
                  .on('end', () => {
                      numbers = [...numbers, ...results];
                      fs.unlinkSync(req.file.path);
                      resolve();
                  })
                  .on('error', reject);
            });
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Error processing CSV file.' });
        }
    }

    // Deduplicate
    numbers = [...new Set(numbers)];

    if (numbers.length === 0 || !message) {
        return res.status(400).json({ success: false, message: 'Phone numbers and message are required.' });
    }

    res.json({ success: true, message: 'Bulk sending started!', total: numbers.length });

    // Process messages in background
    (async () => {
        let sentCount = 0;
        let failedCount = 0;
        
        const now = new Date();
        const campaignName = `Campaign_${now.getFullYear()}${now.getMonth()+1}${now.getDate()}_${now.getHours()}${now.getMinutes()}`;
        console.log(`Starting campaign: ${campaignName}`);
        
        const newCampaign = new Campaign({
            name: campaignName,
            message: message,
            categoryId: categoryId || null,
            categoryName: category || 'Manual/CSV List',
            totalContacts: numbers.length,
            status: 'running',
            contacts: numbers.map(num => ({ phone: num, status: 'pending' }))
        });
        
        try {
            await newCampaign.save();
            console.log('Campaign saved successfully:', newCampaign._id);
        } catch (err) {
            console.error('CRITICAL: Failed to save campaign to DB:', err);
        }
        const campaignId = newCampaign._id;

        activeCampaign = {
            _id: campaignId,
            message: message,
            category: category || 'Database or Manual List',
            total: numbers.length,
            sentCount: 0,
            failedCount: 0,
            status: 'running'
        };
        io.emit('campaign_update', activeCampaign);

        for (let i = 0; i < numbers.length; i++) {
            const num = numbers[i];
            
            let cleanNum = num.replace(/\D/g, '');
            if (cleanNum.length === 10) cleanNum = '91' + cleanNum;
            const formattedNumber = `${cleanNum}@c.us`;

            try {
                await sleep(1000 + Math.random() * 2000); 
                
                const response = await client.sendMessage(formattedNumber, message);
                console.log(`Message sent to ${num}`);
                sentCount++;
                
                // Update global stats
                currentStats.sentCount++;
                Stats.updateOne({}, { $inc: { sentCount: 1 } }).catch(e => console.error(e));
                
                // Update campaign stats
                activeCampaign.sentCount = sentCount;
                
                await Campaign.updateOne(
                    { _id: campaignId, 'contacts.phone': num },
                    { $set: { 'contacts.$.status': 'sent' }, $inc: { sentCount: 1 } }
                );
                
                io.emit('stats_update', currentStats);
                io.emit('campaign_update', activeCampaign);
                
                io.emit('send_progress', { 
                    status: 'success', 
                    number: num, 
                    sentCount, 
                    failedCount, 
                    total: numbers.length 
                });
            } catch (error) {
                console.error(`Failed to send message to ${num}`, error);
                failedCount++;
                
                activeCampaign.failedCount = failedCount;
                
                await Campaign.updateOne(
                    { _id: campaignId, 'contacts.phone': num },
                    { $set: { 'contacts.$.status': 'failed', 'contacts.$.error': error.message }, $inc: { failedCount: 1 } }
                );

                io.emit('campaign_update', activeCampaign);
                
                io.emit('send_progress', { 
                    status: 'failed', 
                    number: num, 
                    error: error.message,
                    sentCount, 
                    failedCount, 
                    total: numbers.length 
                });
            }
        }
        
        activeCampaign.status = 'completed';
        await Campaign.findByIdAndUpdate(campaignId, { status: 'completed' });
        io.emit('campaign_update', activeCampaign);
        
        io.emit('send_completed', { 
            status: 'completed', 
            sentCount, 
            failedCount, 
            total: numbers.length,
            category: category || 'Database or Manual List'
        });
    })();
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
