// controllers/membersController.js
const mongodb = require('../data/database');
const { ObjectId } = require('mongodb');

const getAllMembers = async (req, res) => {
  // #swagger.tags = ['Members']
  try {
    const result = await mongodb.getDatabase().db('final-project').collection('members').find();
    const members = await result.toArray();
    res.setHeader('Content-type', 'application/json');
    res.status(200).json(members);
  } catch (err) {
    res.status(500).json({ message: err.message || 'An error occurred while getting all members' });
  }
};

const getMemberById = async (req, res) => {
  // #swagger.tags = ['Members']
  try {
    if (!req.params.id) {
      return res.status(400).json({ message: 'Member ID is required' });
    }
    const memberId = new ObjectId(req.params.id);
    const result = await mongodb.getDatabase().db('final-project').collection('members').find({ _id: memberId });
    const members = await result.toArray();
    if (members.length === 0) {
      return res.status(404).json({ message: 'Member not found' });
    }
    res.setHeader('Content-type', 'application/json');
    res.status(200).json(members[0]);
  } catch (err) {
    if (err.message.includes('ObjectId') || err.message.includes('BSON')) {
      return res.status(400).json({ message: 'Invalid member ID format' });
    }
    res.status(500).json({ message: err.message || 'An error occurred while getting the member' });
  }
};

const createMember = async (req, res) => {
  // #swagger.tags = ['Members']
  try {
    const requiredFields = ['firstName', 'lastName', 'email', 'phone', 'membershipType'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(req.body.email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    const existingMember = await mongodb.getDatabase().db('final-project').collection('members').findOne({ 
      email: req.body.email.toLowerCase() 
    });
    
    if (existingMember) {
      return res.status(409).json({ message: 'Member with this email already exists' });
    }
    const validMembershipTypes = ['Standard', 'Premium', 'Student', 'Senior'];
    if (!validMembershipTypes.includes(req.body.membershipType)) {
      return res.status(400).json({ 
        message: `Invalid membershipType. Must be one of: ${validMembershipTypes.join(', ')}` 
      });
    }
    if (req.body.address) {
      const addressFields = ['street', 'city', 'state', 'zipCode'];
      const missingAddressFields = addressFields.filter(field => !req.body.address[field]);
      
      if (missingAddressFields.length > 0) {
        return res.status(400).json({ 
          message: `Address missing required fields: ${missingAddressFields.join(', ')}` 
        });
      }
    }
    const maxBooksAllowed = req.body.maxBooksAllowed || (
      req.body.membershipType === 'Premium' ? 5 :
      req.body.membershipType === 'Student' ? 4 : 3
    );
    const member = {
      firstName: req.body.firstName.trim(),
      lastName: req.body.lastName.trim(),
      email: req.body.email.toLowerCase().trim(),
      phone: req.body.phone.trim(),
      address: req.body.address ? {
        street: req.body.address.street.trim(),
        city: req.body.address.city.trim(),
        state: req.body.address.state.trim(),
        zipCode: req.body.address.zipCode.trim()
      } : null,
      membershipDate: req.body.membershipDate ? new Date(req.body.membershipDate) : new Date(),
      membershipType: req.body.membershipType,
      status: req.body.status || 'Active',
      borrowedBooks: 0,
      maxBooksAllowed: maxBooksAllowed,
      createdAt: new Date()
    };
    const response = await mongodb.getDatabase().db('final-project').collection('members').insertOne(member);
    if (response.acknowledged) {
      res.status(201).json({
        id: response.insertedId,
        message: 'Member created successfully',
        member: member
      });
    } else {
      res.status(500).json({ message: 'Failed to create member' });
    }
  } catch (err) {
    res.status(500).json({ 
      message: err.message || 'An error occurred while creating the member' 
    });
  }
};

const updateMember = async (req, res) => {
  // #swagger.tags = ['Members']
  try {
    if (!req.params.id) {
      return res.status(400).json({ message: 'Member ID is required' });
    }
    const memberId = new ObjectId(req.params.id);
    const existingMember = await mongodb.getDatabase().db('final-project').collection('members').findOne({ _id: memberId });
    if (!existingMember) {
      return res.status(404).json({ message: 'Member not found' });
    }
    const updateData = {};
    if (req.body.firstName) updateData.firstName = req.body.firstName.trim();
    if (req.body.lastName) updateData.lastName = req.body.lastName.trim();
    if (req.body.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(req.body.email)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }
      if (req.body.email.toLowerCase() !== existingMember.email) {
        const emailExists = await mongodb.getDatabase().db('final-project').collection('members').findOne({ 
          email: req.body.email.toLowerCase() 
        });
        
        if (emailExists) {
          return res.status(409).json({ message: 'Email is already in use by another member' });
        }
      }
      updateData.email = req.body.email.toLowerCase().trim();
    }
    if (req.body.phone) updateData.phone = req.body.phone.trim();
    if (req.body.address) {
      const addressFields = ['street', 'city', 'state', 'zipCode'];
      const missingAddressFields = addressFields.filter(field => !req.body.address[field]);
      if (missingAddressFields.length > 0) {
        return res.status(400).json({ 
          message: `Address missing required fields: ${missingAddressFields.join(', ')}` 
        });
      }
      updateData.address = {
        street: req.body.address.street.trim(),
        city: req.body.address.city.trim(),
        state: req.body.address.state.trim(),
        zipCode: req.body.address.zipCode.trim()
      };
    }
    if (req.body.membershipType) {
      const validMembershipTypes = ['Standard', 'Premium', 'Student', 'Senior'];
      if (!validMembershipTypes.includes(req.body.membershipType)) {
        return res.status(400).json({ 
          message: `Invalid membershipType. Must be one of: ${validMembershipTypes.join(', ')}` 
        });
      }
      updateData.membershipType = req.body.membershipType;
      if (!req.body.maxBooksAllowed) {
        updateData.maxBooksAllowed = 
          req.body.membershipType === 'Premium' ? 5 :
          req.body.membershipType === 'Student' ? 4 : 3;
      }
    }
    if (req.body.status) {
      const validStatuses = ['Active', 'Inactive', 'Suspended'];
      if (!validStatuses.includes(req.body.status)) {
        return res.status(400).json({ 
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
        });
      }
      updateData.status = req.body.status;
    }
    if (req.body.borrowedBooks !== undefined) {
      if (typeof req.body.borrowedBooks !== 'number' || req.body.borrowedBooks < 0) {
        return res.status(400).json({ message: 'borrowedBooks must be a non-negative number' });
      }
      updateData.borrowedBooks = req.body.borrowedBooks;
    }
    if (req.body.maxBooksAllowed) {
      if (typeof req.body.maxBooksAllowed !== 'number' || req.body.maxBooksAllowed < 1) {
        return res.status(400).json({ message: 'maxBooksAllowed must be a positive number' });
      }
      updateData.maxBooksAllowed = req.body.maxBooksAllowed;
    }
    if (req.body.membershipDate) {
      updateData.membershipDate = new Date(req.body.membershipDate);
    }
    const newBorrowedBooks = updateData.borrowedBooks ?? existingMember.borrowedBooks;
    const newMaxBooksAllowed = updateData.maxBooksAllowed ?? existingMember.maxBooksAllowed;
    if (newBorrowedBooks > newMaxBooksAllowed) {
      return res.status(400).json({ 
        message: 'borrowedBooks cannot exceed maxBooksAllowed' 
      });
    }
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No fields to update provided' });
    }
    const response = await mongodb.getDatabase().db('final-project').collection('members').updateOne(
      { _id: memberId },
      { $set: updateData }
    );
    if (response.modifiedCount > 0) {
      const updatedMember = await mongodb.getDatabase().db('final-project').collection('members').findOne({ _id: memberId });
      res.status(200).json({ 
        message: 'Member updated successfully',
        member: updatedMember
      });
    } else {
      res.status(200).json({ message: 'No changes made to the member' });
    }
  } catch (err) {
    if (err.message.includes('ObjectId') || err.message.includes('BSON')) {
      return res.status(400).json({ message: 'Invalid member ID format' });
    }
    res.status(500).json({ 
      message: err.message || 'An error occurred while updating the member' 
    });
  }
};

const deleteMember = async (req, res) => {
  // #swagger.tags = ['Members']
  try {
    if (!req.params.id) {
      return res.status(400).json({ message: 'Member ID is required' });
    }
    const memberId = new ObjectId(req.params.id);
    const existingMember = await mongodb.getDatabase().db('final-project').collection('members').findOne({ _id: memberId });
    if (!existingMember) {
      return res.status(404).json({ message: 'Member not found' });
    }
    const activeBorrowings = await mongodb.getDatabase().db('final-project').collection('borrowing').find({ 
      memberId: memberId,
      status: { $in: ['Borrowed', 'Overdue'] }
    }).toArray();
    if (activeBorrowings.length > 0) {
      return res.status(409).json({ 
        message: 'Cannot delete member with active borrowings. Please return all books first.',
        activeBorrowingsCount: activeBorrowings.length
      });
    }
    const response = await mongodb.getDatabase().db('final-project').collection('members').deleteOne({ _id: memberId });
    if (response.deletedCount > 0) {
      res.status(200).json({ 
        message: 'Member deleted successfully',
        id: memberId
      });
    } else {
      res.status(500).json({ message: 'Failed to delete member' });
    }
  } catch (err) {
    if (err.message.includes('ObjectId') || err.message.includes('BSON')) {
      return res.status(400).json({ message: 'Invalid member ID format' });
    }
    res.status(500).json({ 
      message: err.message || 'An error occurred while deleting the member' 
    });
  }
};

module.exports = {
  getAllMembers,
  getMemberById,
  createMember,
  updateMember,
  deleteMember
};