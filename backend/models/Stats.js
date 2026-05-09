const mongoose = require('mongoose');

const StatsSchema = new mongoose.Schema({
    sentCount: {
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
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// We only need one document to track global stats
// We will use a predefined ID or just the first document found.
module.exports = mongoose.model('Stats', StatsSchema);
