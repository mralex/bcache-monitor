import mongoose, { Schema } from 'mongoose';

const logSchema = new Schema({
    timestamp: Date,
    data: Schema.Types.Mixed
});

logSchema.pre('save', function(next) {
    this.timestamp = new Date();
    next();
});

const Log = mongoose.model('Log', logSchema);
export default Log;
