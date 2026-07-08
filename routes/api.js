const express=require('express');
const  router=express.Router();
const verifyToken = require('../middleware/verifytoken');
const AuthController = require('../controller/AuthController');
const UserController = require('../controller/UserController');
const SubscriptionController = require('../controller/SubscriptionController');
const ChatController = require('../controller/ChatController');
const NotificationController = require('../controller/NotificationController');
// login
router.post('/login', AuthController.login);
router.post('/send-login-otp', AuthController.sendLoginOtp);
router.post('/verify-login-otp', AuthController.verifyLoginOtp);
router.post('/send-otp', AuthController.sendOtp);
router.post('/verify-otp', AuthController.verifyOtp);
router.post('/forgot-password', AuthController.sendForgotPasswordOtp);
router.post('/reset-password', AuthController.resetPassword);
router.get('/users', verifyToken, UserController.getAllUsers);

// user
router.get('/user', verifyToken, UserController.getAllUsers);
router.post('/user', UserController.createUser);
router.put('/user', verifyToken, UserController.updateCurrentUser);
router.get('/user/:id', verifyToken, UserController.getUserById);
router.put('/user/:id', verifyToken, UserController.updateUser);

// subscriber dashboard and plans
router.get('/subscription/plans', verifyToken, SubscriptionController.plans);
router.post('/subscription/activate', verifyToken, SubscriptionController.activate);
router.get('/subscriber-dashboard', verifyToken, SubscriptionController.dashboard);
router.post('/subscriber-dashboard', verifyToken, SubscriptionController.dashboard);

// chat and notifications
router.get('/chat/conversations', verifyToken, ChatController.conversations);
router.get('/chat/conversations/:conversationId/messages', verifyToken, ChatController.messages);
router.post('/chat/conversations/:conversationId/messages', verifyToken, ChatController.createMessage);
router.get('/notifications', verifyToken, NotificationController.list);
router.post('/notifications', verifyToken, NotificationController.create);
router.put('/notifications/:notificationId/read', verifyToken, NotificationController.markRead);

module.exports=router;
