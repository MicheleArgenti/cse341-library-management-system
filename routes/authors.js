const express = require('express');
const router = express.Router();

const authorController = require('../controllers/authorsController');
// Implement next week 
// const { isAuthenticated } = require('../middleware/authenticate');

router.get('/', authorController.getAllAuthors);
router.get('/:id', authorController.getAuthorById);

router.post('/', /*isAuthenticated,*/ authorController.createAuthor);
router.put('/:id', /*isAuthenticated,*/ authorController.updateAuthor);
router.delete('/:id', /*isAuthenticated,*/ authorController.deleteAuthor);

module.exports = router;