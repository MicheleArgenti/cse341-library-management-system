const express = require('express');
const router = express.Router();

const booksController = require('../controllers/booksController');
const { isAuthenticated } = require('../middleware/authenticate');

router.get('/', booksController.getAllBooks);
router.get('/:id', booksController.getBookById);

router.post('/', isAuthenticated, booksController.createBook);
router.put('/:id', isAuthenticated, booksController.updateBook);
router.delete('/:id', isAuthenticated, booksController.deleteBook);

module.exports = router;