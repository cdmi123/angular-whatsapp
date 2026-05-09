const mongoose = require('mongoose');

const CampaignSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    imageUrl: {
        type: String,
        default: ''
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
    },
    categoryName: {
        type: String,
        default: 'Manual/CSV'
    },
    totalContacts: {
        type: Number,
        default: 0
    },
    sentCount: {
        type: Number,
        default: 0
    },
    failedCount: {
        type: Number,
        default: 0
    },
    receivedCount: {
        type: Number,
        default: 0
    },
    readCount: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['pending', 'running', 'completed', 'failed'],
        default: 'pending'
    },
    contacts: [{
        phone: String,
        name: String,
        status: {
            type: String,
            enum: ['pending', 'sent', 'failed', 'received', 'read'],
            default: 'pending'
        },
        error: String,
        lastInteraction: Date
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for faster lookup when receiving messages
CampaignSchema.index({ 'contacts.phone': 1, createdAt: -1 });

module.exports = mongoose.model('Campaign', CampaignSchema);
