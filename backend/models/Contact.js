import { model, Schema } from "mongoose";

const contactSchema = new Schema({
    id: { type: String, unique: true},
    name: String,
    avatar: String,
    status: String,
    lastSeen: String,
    lastMessage: String,
    time: String,
    unread: Number,
    pinned: Boolean,
    archived: Boolean,
    isGroup: { type: Boolean, default: false },
    typing: {type: Boolean, default: false},
});

export default model('Contact', contactSchema);