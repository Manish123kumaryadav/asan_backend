const express=require('express');
const  router=express.Router();
const verifyToken = require('../middleware/verifytoken');
const AuthController = require('../controller/AuthController');
const UserController = require('../controller/UserController');
const SubscriptionController = require('../controller/SubscriptionController');
const ChatController = require('../controller/ChatController');
const NotificationController = require('../controller/NotificationController');
const ListingController = require('../controller/ListingController');
const OrderController = require('../controller/OrderController');
const PaymentController = require('../controller/PaymentController');
const CallController = require('../controller/CallController');
const MediaController = require('../controller/MediaController');
const LocationController = require('../controller/LocationController');
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
router.post('/chat/listings/:listingId', verifyToken, ChatController.openForListing);
router.get('/chat/conversations', verifyToken, ChatController.conversations);
router.get('/chat/conversations/:conversationId/messages', verifyToken, ChatController.messages);
router.post('/chat/conversations/:conversationId/messages', verifyToken, ChatController.createMessage);
router.get('/notifications', verifyToken, NotificationController.list);
router.post('/notifications', verifyToken, NotificationController.create);
router.put('/notifications/:notificationId/read', verifyToken, NotificationController.markRead);

// listings
router.get('/listings', ListingController.list);
router.get('/listings/manage', verifyToken, ListingController.manage);
router.get('/listings/:listingId', ListingController.getById);
router.post('/listings', verifyToken, ListingController.create);
router.put('/listings/:listingId', verifyToken, ListingController.update);
router.delete('/listings/:listingId', verifyToken, ListingController.remove);
router.put('/listings/:listingId/status', verifyToken, ListingController.review);
router.post('/listings/:listingId/contact', verifyToken, ListingController.contact);

// orders
router.get('/orders', verifyToken, OrderController.list);
router.post('/orders', verifyToken, OrderController.create);
router.get('/orders/:orderId/track', verifyToken, OrderController.track);

// payments
router.post('/payments/upi-intent', verifyToken, PaymentController.createUpiIntent);
router.post('/payments/razorpay/order', verifyToken, PaymentController.createRazorpayOrder);
router.post('/payments/verify', verifyToken, PaymentController.verify);

// calls
router.post('/calls/start', verifyToken, CallController.start);
router.post('/calls/:callId/end', verifyToken, CallController.end);
router.put('/calls/preferences', verifyToken, CallController.updatePreferences);

// media
router.post('/media/upload/product', verifyToken, MediaController.upload('product'));
router.post('/media/upload/avatar', verifyToken, MediaController.upload('avatar'));
router.get('/media/object/:bucket/:userGuid/:fileName', MediaController.object);

// location
router.get('/location/reverse', LocationController.reverse);

module.exports=router;
