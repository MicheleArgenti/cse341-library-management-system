const express = require('express');
const router = express.Router();

const borrowingController = require('../controllers/borrowingController');
const { isAuthenticated } = require('../middleware/authenticate');

router.get('/', borrowingController.getAllBorrowings);
router.get('/:id', borrowingController.getBorrowingById);

router.post('/borrow', isAuthenticated, borrowingController.borrowBook);
router.put('/return/:id', isAuthenticated, borrowingController.returnBook);
router.delete('/:id', isAuthenticated, borrowingController.deleteBorrowing);

module.exports = router;