const express = require('express');
const router = express.Router();

const membersController = require('../controllers/membersController');
const { isAuthenticated } = require('../middleware/authenticate');

router.get('/', membersController.getAllMembers);
router.get('/:id', membersController.getMemberById);

router.post('/', isAuthenticated, membersController.createMember);
router.put('/:id', isAuthenticated, membersController.updateMember);
router.delete('/:id', isAuthenticated, membersController.deleteMember);

module.exports = router;