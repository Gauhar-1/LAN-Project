const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');


const app = express();
// ✅ SSL certificate setup
// const sslOptions = {
//   key: fs.readFileSync("D:/lan only/ssl/key.pem"),
//   cert: fs.readFileSync("D:/lan only/ssl/cert.pem"),
// };

// ✅ Create HTTPS server
// const server = https.createServer(sslOptions, app);
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Routes
const authRoutes = require('./routes/authRoutes');
const callRoutes = require('./routes/callRoutes');
app.use('/auth', authRoutes);
app.use('/call', callRoutes);

// Socket user mappings
const userSocketMap = {};     // userId => socket.id
const socketUserMap = {};     // socket.id => userId

// ========================
// 🔌 SOCKET.IO LOGIC
// ========================
io.on('connection', (socket) => {
  console.log('📡 Client connected:', socket.id);

   // ✅ Register (frontend expects this)
  // socket.on('register', (username) => {
  //   console.log(`✅ Registered (frontend): ${username}`);
  //   userSocketMap[username] = socket.id;
  //   socketUserMap[socket.id] = username;
  //   io.emit('users', Object.keys(userSocketMap));
  // });

  socket.on('register-user', (userId) => {
    console.log(`✅ Registered (backend): ${userId}, socket: ${socket.id}`);
    userSocketMap[userId] = socket.id;
    socketUserMap[socket.id] = userId;
    io.emit('users', Object.keys(userSocketMap));
  });
  
  // ✅ Voice call (frontend expects `call-user`)
  socket.on('call-user', ({ to, offer }) => {
    console.log(`📞 call-user: trying to call ${to}`);
     const receiverSocket = userSocketMap[to];
    const from = socketUserMap[socket.id]
    if (receiverSocket) {
      console.log(`📞 Backend callRequest: ${socketUserMap[socket.id]} → ${to}`);
      io.to(receiverSocket).emit('incoming-call', { from, offer });
    }
  });
  

  // ✅ Accept call (frontend)
  socket.on('accept-call', ({ to, answer }) => {
    const receiverSocket = userSocketMap[to];
    if (receiverSocket) {
      io.to(receiverSocket).emit('call-answered', { from: socket.id, answer });
    }
  });

  // ✅ Reject call (frontend)
  socket.on('reject-call', ({ to }) => {
    const receiverSocket = userSocketMap[to];
    if (receiverSocket) {
      io.to(receiverSocket).emit('call-rejected', { from: socket.id });
    }
  });

  // ✅ ICE candidate (frontend & backend compatible)
  socket.on('ice-candidate', ({ to, candidate }) => {
    const receiverSocket = userSocketMap[to];
    if (receiverSocket) {
      io.to(receiverSocket).emit('ice-candidate', { from: socket.id, candidate });
    }
  });

  // ✅ Backend-only: Initiate call via callerId/receiverId
  socket.on('callRequest', ({ to, offer }) => {
    const receiverSocket = userSocketMap[to];
    const from = socketUserMap[socket.id]
    if (receiverSocket) {
      console.log(`📞 Backend callRequest: ${socketUserMap[socket.id]} → ${to}`);
      io.to(receiverSocket).emit('incoming-call', { from, offer });
    }
  });

  // // ✅ Backend-only WebRTC signaling
  // socket.on('offer', ({ from, targetId, offer }) => {
  //   const targetSocket = userSocketMap[targetId];
  //   if (targetSocket) {
  //     io.to(targetSocket).emit('offer', { from, offer });
  //   }
  // });

  socket.on('accept-call', ({ targetId, answer }) => {
    const targetSocket = userSocketMap[targetId];
    if (targetSocket) {
      io.to(targetSocket).emit('call-answered', { answer });
    }
  });

  // socket.on('candidate', ({ targetId, candidate }) => {
  //   const targetSocket = userSocketMap[targetId];
  //   if (targetSocket) {
  //     io.to(targetSocket).emit('candidate', { candidate });
  //   }
  // });

  // FILE TRANSFER SIGNALING EVENTS

  // Offer from sender to receiver for file transfer
  socket.on('file-transfer-offer', ({ toUserId, offer, fromUserId }) => {
    const receiverSocketId = userSocketMap.get(toUserId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('file-transfer-offer', { offer, fromUserId });
    }
  });

  // Answer from receiver to sender for file transfer
  socket.on('file-transfer-answer', ({ toUserId, answer, fromUserId }) => {
    const senderSocketId = userSocketMap.get(toUserId);
    if (senderSocketId) {
      io.to(senderSocketId).emit('file-transfer-answer', { answer, fromUserId });
    }
  });

  // ICE candidate from either peer during file transfer connection setup
  socket.on('file-transfer-ice-candidate', ({ toUserId, candidate, fromUserId }) => {
    const peerSocketId = userSocketMap.get(toUserId);
    if (peerSocketId) {
      io.to(peerSocketId).emit('file-transfer-ice-candidate', { candidate, fromUserId });
    }
  });

  // Optional: Handle user disconnect cleanup if needed
  socket.on('disconnect', () => {
    // Remove user from userSocketMap if needed
    for (let [userId, sId] of userSocketMap.entries()) {
      if (sId === socket.id) {
        userSocketMap.delete(userId);
        console.log(`User disconnected and removed: ${userId}`);
        break;
      }
    }
  });
  

  // ✅ Disconnect
  socket.on('disconnect', () => {
    const userId = socketUserMap[socket.id];
    console.log(`❌ Disconnected: ${socket.id}`);
    if (userId) {
      delete userSocketMap[userId];
    }
    delete socketUserMap[socket.id];
    io.emit('users', Object.keys(userSocketMap));
  });
});

// ========================
// 🔁 Start the server
// ========================
const PORT = 3000;
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "test_client.html"));
});

server.listen(3000, '0.0.0.0', () => {
  console.log('✅ Server running on port 3000 (LAN-accessible)');
});

