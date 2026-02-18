// controllers/borrowingController.js
const mongodb = require('../data/database');
const { ObjectId } = require('mongodb');

const getAllBorrowings = async (req, res) => {
  // #swagger.tags = ['Borrowing']
  try {
    const result = await mongodb.getDatabase().db('final-project').collection('borrowing').find();
    const borrowings = await result.toArray();
    for (let borrowing of borrowings) {
      if (borrowing.bookId) {
        const book = await mongodb.getDatabase().db('final-project').collection('books').findOne({ _id: borrowing.bookId });
        borrowing.bookDetails = book;
      }
      if (borrowing.memberId) {
        const member = await mongodb.getDatabase().db('final-project').collection('members').findOne({ _id: borrowing.memberId });
        borrowing.memberDetails = member;
      }
    }
    res.setHeader('Content-type', 'application/json');
    res.status(200).json(borrowings);
  } catch (err) {
    res.status(500).json({ message: err.message || 'An error occurred while getting all borrowings' });
  }
};

const getBorrowingById = async (req, res) => {
  // #swagger.tags = ['Borrowing']
  try {
    if (!req.params.id) {
      return res.status(400).json({ message: 'Borrowing ID is required' });
    }
    const borrowingId = new ObjectId(req.params.id);
    const result = await mongodb.getDatabase().db('final-project').collection('borrowing').find({ _id: borrowingId });
    const borrowings = await result.toArray();
    if (borrowings.length === 0) {
      return res.status(404).json({ message: 'Borrowing record not found' });
    }
    const borrowing = borrowings[0];
    if (borrowing.bookId) {
      const book = await mongodb.getDatabase().db('final-project').collection('books').findOne({ _id: borrowing.bookId });
      borrowing.bookDetails = book;
    }
    if (borrowing.memberId) {
      const member = await mongodb.getDatabase().db('final-project').collection('members').findOne({ _id: borrowing.memberId });
      borrowing.memberDetails = member;
    }
    res.setHeader('Content-type', 'application/json');
    res.status(200).json(borrowing);
  } catch (err) {
    if (err.message.includes('ObjectId') || err.message.includes('BSON')) {
      return res.status(400).json({ message: 'Invalid borrowing ID format' });
    }
    res.status(500).json({ message: err.message || 'An error occurred while getting the borrowing record' });
  }
};

const borrowBook = async (req, res) => {
  // #swagger.tags = ['Borrowing']
  try {
    const requiredFields = ['bookId', 'memberId'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }
    const bookId = new ObjectId(req.body.bookId);
    const memberId = new ObjectId(req.body.memberId);
    const book = await mongodb.getDatabase().db('final-project').collection('books').findOne({ _id: bookId });
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }
    if (book.availableCopies <= 0) {
      return res.status(400).json({ message: 'No copies available for borrowing' });
    }
    const member = await mongodb.getDatabase().db('final-project').collection('members').findOne({ _id: memberId });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }
    if (member.status !== 'Active') {
      return res.status(400).json({ message: 'Member account is not active' });
    }
    if (member.borrowedBooks >= member.maxBooksAllowed) {
      return res.status(400).json({ 
        message: `Member has reached maximum allowed books (${member.maxBooksAllowed})` 
      });
    }
    const existingBorrowing = await mongodb.getDatabase().db('final-project').collection('borrowing').findOne({
      bookId: bookId,
      memberId: memberId,
      status: { $in: ['Borrowed', 'Overdue'] }
    });
    if (existingBorrowing) {
      return res.status(400).json({ message: 'Member already has this book borrowed and not returned' });
    }
    const borrowDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (req.body.loanDays || 14));
    const borrowing = {
      bookId: bookId,
      memberId: memberId,
      borrowDate: borrowDate,
      dueDate: dueDate,
      returnDate: null,
      status: 'Borrowed',
      renewalCount: 0,
      notes: req.body.notes || '',
      createdAt: new Date()
    };
    const session = mongodb.getDatabase().startSession();
    session.startTransaction();
    try {
      const response = await mongodb.getDatabase().db('final-project').collection('borrowing').insertOne(borrowing, { session });
      await mongodb.getDatabase().db('final-project').collection('books').updateOne(
        { _id: bookId },
        { $inc: { availableCopies: -1 } },
        { session }
      );
      await mongodb.getDatabase().db('final-project').collection('members').updateOne(
        { _id: memberId },
        { $inc: { borrowedBooks: 1 } },
        { session }
      );
      await session.commitTransaction();
      if (response.acknowledged) {
        res.status(201).json({
          id: response.insertedId,
          message: 'Book borrowed successfully',
          borrowing: {
            ...borrowing,
            _id: response.insertedId
          }
        });
      } else {
        await session.abortTransaction();
        res.status(500).json({ message: 'Failed to create borrowing record' });
      }
    } catch (transactionError) {
      await session.abortTransaction();
      throw transactionError;
    } finally {
      session.endSession();
    }
  } catch (err) {
    if (err.message.includes('ObjectId') || err.message.includes('BSON')) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    res.status(500).json({ 
      message: err.message || 'An error occurred while borrowing the book' 
    });
  }
};

const returnBook = async (req, res) => {
  // #swagger.tags = ['Borrowing']
  try {
    if (!req.params.id) {
      return res.status(400).json({ message: 'Borrowing ID is required' });
    }
    const borrowingId = new ObjectId(req.params.id);
    const borrowing = await mongodb.getDatabase().db('final-project').collection('borrowing').findOne({ _id: borrowingId });
    if (!borrowing) {
      return res.status(404).json({ message: 'Borrowing record not found' });
    }
    if (borrowing.status === 'Returned') {
      return res.status(400).json({ message: 'Book has already been returned' });
    }
    const returnDate = new Date();
    let status = 'Returned';
    let lateFee = 0;
    if (returnDate > borrowing.dueDate) {
      status = 'Returned (Late)';
      const daysLate = Math.ceil((returnDate - borrowing.dueDate) / (1000 * 60 * 60 * 24));
      lateFee = daysLate * 1.00; 
    }
    const session = mongodb.getDatabase().startSession();
    session.startTransaction();
    try {
      const response = await mongodb.getDatabase().db('final-project').collection('borrowing').updateOne(
        { _id: borrowingId },
        { 
          $set: { 
            returnDate: returnDate,
            status: status,
            lateFee: lateFee
          } 
        },
        { session }
      );
      await mongodb.getDatabase().db('final-project').collection('books').updateOne(
        { _id: borrowing.bookId },
        { $inc: { availableCopies: 1 } },
        { session }
      );
      await mongodb.getDatabase().db('final-project').collection('members').updateOne(
        { _id: borrowing.memberId },
        { $inc: { borrowedBooks: -1 } },
        { session }
      );
      await session.commitTransaction();
      if (response.modifiedCount > 0) {
        res.status(200).json({ 
          message: 'Book returned successfully',
          lateFee: lateFee > 0 ? `$${lateFee.toFixed(2)}` : 'No late fee',
          returnDate: returnDate
        });
      } else {
        await session.abortTransaction();
        res.status(500).json({ message: 'Failed to update borrowing record' });
      }
    } catch (transactionError) {
      await session.abortTransaction();
      throw transactionError;
    } finally {
      session.endSession();
    }
  } catch (err) {
    if (err.message.includes('ObjectId') || err.message.includes('BSON')) {
      return res.status(400).json({ message: 'Invalid borrowing ID format' });
    }
    res.status(500).json({ 
      message: err.message || 'An error occurred while returning the book' 
    });
  }
};

const deleteBorrowing = async (req, res) => {
  // #swagger.tags = ['Borrowing']
  try {
    if (!req.params.id) {
      return res.status(400).json({ message: 'Borrowing ID is required' });
    }
    const borrowingId = new ObjectId(req.params.id);
    const borrowing = await mongodb.getDatabase().db('final-project').collection('borrowing').findOne({ _id: borrowingId });
    if (!borrowing) {
      return res.status(404).json({ message: 'Borrowing record not found' });
    }
    if (borrowing.status !== 'Returned') {
      return res.status(400).json({ 
        message: 'Cannot delete an active borrowing record. Please return the book first.' 
      });
    }
    const response = await mongodb.getDatabase().db('final-project').collection('borrowing').deleteOne({ _id: borrowingId });
    if (response.deletedCount > 0) {
      res.status(200).json({ 
        message: 'Borrowing record deleted successfully',
        id: borrowingId
      });
    } else {
      res.status(500).json({ message: 'Failed to delete borrowing record' });
    }
  } catch (err) {
    if (err.message.includes('ObjectId') || err.message.includes('BSON')) {
      return res.status(400).json({ message: 'Invalid borrowing ID format' });
    }
    res.status(500).json({ 
      message: err.message || 'An error occurred while deleting the borrowing record' 
    });
  }
};

module.exports = {
  getAllBorrowings,
  getBorrowingById,
  borrowBook,
  returnBook,
  deleteBorrowing
};