const express=require('express');
const  router=express.Router();
// login
router.post('/login',require('../controller/AuthController').login);
router.post('/send-login-otp',require('../controller/AuthController').sendLoginOtp);
router.post('/verify-login-otp',require('../controller/AuthController').verifyLoginOtp);
router.post('/forgot-password',require('../controller/AuthController').sendForgotPasswordOtp);
router.post('/reset-password',require('../controller/AuthController').resetPassword);
router.get('/users',require('../controller/MainUserController').getAllUsers);

// user
router.get('/user',require('../controller/UserController').getAllUsers);
router.post('/user',require('../controller/UserController').createUser);
router.get('/user/:id',require('../controller/UserController').getUserById);
router.put('/user/:id',require('../controller/UserController').updateUser);
module.exports=router;
