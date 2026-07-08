const express=require('express');
const  router=express.Router();
const verifyToken = require('../middleware/verifytoken');
const ListingController = require('../controller/ListingController');
const OrderController = require('../controller/OrderController');
const NotificationController = require('../controller/NotificationController');
const ChatController = require('../controller/ChatController');
const PaymentController = require('../controller/PaymentController');
const SubscriptionController = require('../controller/SubscriptionController');
const CallController = require('../controller/CallController');
const MediaController = require('../controller/MediaController');
// login
router.post('/login',require('../controller/AuthController').login);
router.post('/send-login-otp',require('../controller/AuthController').sendLoginOtp);
router.post('/verify-login-otp',require('../controller/AuthController').verifyLoginOtp);
router.post('/forgot-password',require('../controller/AuthController').sendForgotPasswordOtp);
router.post('/reset-password',require('../controller/AuthController').resetPassword);
router.get('/users',require('../controller/UserController').getAllUsers);

// user
router.get('/user',require('../controller/UserController').getAllUsers);
router.post('/user',require('../controller/UserController').createUser);
router.get('/user/:id',require('../controller/UserController').getUserById);
router.put('/user/:id',require('../controller/UserController').updateUser);
router.get('/me', verifyToken, require('../controller/UserController').getMe);
router.patch('/me', verifyToken, require('../controller/UserController').updateMe);
router.put('/me', verifyToken, require('../controller/UserController').updateMe);

// marketplace
router.get('/listings', ListingController.list);
router.post('/listings', verifyToken, ListingController.create);
router.post('/listings/:listingId/contact', verifyToken, ListingController.contact);

// orders and notifications
router.get('/orders', verifyToken, OrderController.list);
router.post('/orders', verifyToken, OrderController.create);
router.get('/orders/:orderId/track', verifyToken, OrderController.track);
router.get('/orders/:orderId', verifyToken, OrderController.track);
router.get('/notifications', verifyToken, NotificationController.list);
router.post('/notifications/:notificationId/read', verifyToken, NotificationController.markRead);

// chat
router.get('/chat/conversations', verifyToken, ChatController.conversations);
router.get('/chat/conversations/:conversationId/messages', verifyToken, ChatController.messages);
router.post('/chat/conversations/:conversationId/messages', verifyToken, ChatController.createMessage);

// calls, payments, subscriptions
router.post('/calls/start', verifyToken, CallController.start);
router.post('/calls/:callId/end', verifyToken, CallController.end);
router.patch('/users/me/call-preferences', verifyToken, CallController.updatePreferences);
router.post('/payments/upi-intent', verifyToken, PaymentController.createUpiIntent);
router.post('/payments/verify', verifyToken, PaymentController.verify);
router.get('/subscriptions/plans', SubscriptionController.plans);
router.post('/subscriptions/activate', verifyToken, SubscriptionController.activate);
router.post('/upload/avatar', verifyToken, MediaController.upload('avatar'));
router.post('/upload/product', verifyToken, MediaController.upload('product'));
module.exports=router;
