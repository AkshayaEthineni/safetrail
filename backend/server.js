const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fileUpload = require('express-fileupload');
const connectDB = require('./config/db');
const User = require('./models/User');

dotenv.config();

const seedEmergencyOperator = async () => {
  try {
    const operatorEmail = 'operator@safetrail.com';
    const operatorPassword = 'Emergency@123';

    const existingByEmail = await User.findOne({ email: operatorEmail });
    if (existingByEmail) {
      console.log(`Emergency operator account already exists: ${existingByEmail.email}`);
      return;
    }

    const existingOperatorRole = await User.findOne({ role: 'operator' });
    if (existingOperatorRole) {
      console.log(`An operator role account already exists: ${existingOperatorRole.email}`);
      return;
    }

    await User.create({
      name: 'Emergency Operator',
      email: operatorEmail,
      password: operatorPassword,
      phone: '9999999999',
      emergencyContact: { name: 'Control Center', phone: '9999999999' },
      role: 'operator'
    });
    console.log(`Created emergency operator login: ${operatorEmail} / ${operatorPassword}`);
  } catch (error) {
    console.error('Failed to seed emergency operator account:', error.message);
  }
};

connectDB().then(seedEmergencyOperator);

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH']
  }
});

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
}));
app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/journey', require('./routes/journey'));
app.use('/api/incident', require('./routes/incident'));
app.use('/api/assistant', require('./routes/assistant'));
app.use('/api/emergency', require('./routes/emergency'));
app.use('/api/analytics', require('./routes/analytics'));

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('join', (data) => {
    if (data?.userId) {
      socket.join(data.userId);
    }
  });

  socket.on('locationUpdate', (data) => {
    io.emit('touristLocation', data);
  });

  socket.on('sosTriggered', (data) => {
    io.emit('newIncident', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

app.set('io', io);

app.get('*', (req, res) => {
  const requestedPath = req.path === '/' ? '/index.html' : req.path;
  const filePath = path.join(__dirname, '../frontend', requestedPath);
  res.sendFile(filePath, (err) => {
    if (err) {
      res.sendFile(path.join(__dirname, '../frontend/index.html'));
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
