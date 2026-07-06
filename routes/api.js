const express=require('express');
const  router=express.Router();
// login
router.post('/login',require('../controller/AuthController').login);
router.get('/users',require('../controller/MainUserController').getAllUsers);

// user
router.post('/user',require('../controller/UserController').createUser);
router.get('/user/:id',require('../controller/UserController').getUserById);
router.put('/user/:id',require('../controller/UserController').updateUser);
module.exports=router;