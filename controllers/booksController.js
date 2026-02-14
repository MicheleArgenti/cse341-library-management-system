// controllers/booksController.js
const mongodb = require('../data/database');
const { ObjectId } = require('mongodb');

const getAllBooks = async (req, res) => {
  // #swagger.tags = ['Books']
  try {
    const result = await mongodb.getDatabase().db('final-project').collection('books').find();
    const books = await result.toArray();
    res.setHeader('Content-type', 'application/json');
    res.status(200).json(books);
  } catch (err) {
    res.status(500).json({ message: err.message || 'An error occurred while getting all the books' });
  }
};

const getBookById = async (req, res) => {
  // #swagger.tags = ['Books']
  try {
    if (!req.params.id) {
      return res.status(400).json({ message: 'Book ID is required' });
    }
    const bookId = new ObjectId(req.params.id);
    const result = await mongodb.getDatabase().db('final-project').collection('books').find({ _id: bookId });
    const books = await result.toArray();
    if (books.length === 0) {
      return res.status(404).json({ message: 'Book not found' });
    }
    res.setHeader('Content-type', 'application/json');
    res.status(200).json(books[0]);
  } catch (err) {
    if (err.message.includes('ObjectId') || err.message.includes('BSON')) {
      return res.status(400).json({ message: 'Invalid book ID format' });
    }
    res.status(500).json({ message: err.message || 'An error occurred while getting the book' });
  }
};

const createBook = async (req, res) => {
  // #swagger.tags = ['Books']
  try {
    const requiredFields = ['title', 'author', 'isbn', 'publishedYear', 'publisher', 'pages', 'totalCopies'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }
    if (typeof req.body.publishedYear !== 'number') {
      return res.status(400).json({ message: 'publishedYear must be a number' });
    }
    if (typeof req.body.pages !== 'number') {
      return res.status(400).json({ message: 'pages must be a number' });
    }
    if (typeof req.body.totalCopies !== 'number') {
      return res.status(400).json({ message: 'totalCopies must be a number' });
    }
    const availableCopies = req.body.availableCopies !== undefined ? req.body.availableCopies : req.body.totalCopies;
    if (availableCopies > req.body.totalCopies) {
      return res.status(400).json({ 
        message: 'availableCopies cannot exceed totalCopies' 
      });
    }
    if (req.body.genre && !Array.isArray(req.body.genre)) {
      return res.status(400).json({ message: 'genre must be an array' });
    }
    const book = {
      title: req.body.title.trim(),
      author: req.body.author.trim(),
      isbn: req.body.isbn.trim(),
      genre: req.body.genre || [],
      publishedYear: req.body.publishedYear,
      publisher: req.body.publisher.trim(),
      pages: req.body.pages,
      availableCopies: availableCopies,
      totalCopies: req.body.totalCopies,
      createdAt: new Date()
    };
    const response = await mongodb.getDatabase().db('final-project').collection('books').insertOne(book);
    if (response.acknowledged) {
      res.status(201).json({
        id: response.insertedId,
        message: 'Book created successfully',
        book: book
      });
    } else {
      res.status(500).json({ message: 'Failed to create book' });
    }
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ 
        message: 'Book with this ISBN already exists' 
      });
    }
    res.status(500).json({ 
      message: err.message || 'An error occurred while creating the book' 
    });
  }
};

const updateBook = async (req, res) => {
  // #swagger.tags = ['Books']
  try {
    if (!req.params.id) {
      return res.status(400).json({ message: 'Book ID is required' });
    }
    const bookId = new ObjectId(req.params.id);
    const existingBook = await mongodb.getDatabase().db('final-project').collection('books').findOne({ _id: bookId });
    if (!existingBook) {
      return res.status(404).json({ message: 'Book not found' });
    }
    const updateData = {};
    if (req.body.title) updateData.title = req.body.title.trim();
    if (req.body.author) updateData.author = req.body.author.trim();
    if (req.body.isbn) updateData.isbn = req.body.isbn.trim();
    if (req.body.genre) {
      if (!Array.isArray(req.body.genre)) {
        return res.status(400).json({ message: 'genre must be an array' });
      }
      updateData.genre = req.body.genre;
    }
    if (req.body.publishedYear) {
      if (typeof req.body.publishedYear !== 'number') {
        return res.status(400).json({ message: 'publishedYear must be a number' });
      }
      updateData.publishedYear = req.body.publishedYear;
    }
    if (req.body.publisher) updateData.publisher = req.body.publisher.trim();
    if (req.body.pages) {
      if (typeof req.body.pages !== 'number') {
        return res.status(400).json({ message: 'pages must be a number' });
      }
      updateData.pages = req.body.pages;
    }
    if (req.body.availableCopies !== undefined) {
      if (typeof req.body.availableCopies !== 'number') {
        return res.status(400).json({ message: 'availableCopies must be a number' });
      }
      updateData.availableCopies = req.body.availableCopies;
    }
    if (req.body.totalCopies) {
      if (typeof req.body.totalCopies !== 'number') {
        return res.status(400).json({ message: 'totalCopies must be a number' });
      }
      updateData.totalCopies = req.body.totalCopies;
    }
    const newAvailableCopies = updateData.availableCopies ?? existingBook.availableCopies;
    const newTotalCopies = updateData.totalCopies ?? existingBook.totalCopies;
    if (newAvailableCopies > newTotalCopies) {
      return res.status(400).json({ 
        message: 'availableCopies cannot exceed totalCopies' 
      });
    }
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No fields to update provided' });
    }
    const response = await mongodb.getDatabase().db('final-project').collection('books').updateOne(
      { _id: bookId },
      { $set: updateData }
    );
    if (response.modifiedCount > 0) {
      res.status(200).json({ 
        message: 'Book updated successfully',
        id: bookId
      });
    } else {
      res.status(200).json({ message: 'No changes made to the book' });
    }
  } catch (err) {
    if (err.message.includes('ObjectId') || err.message.includes('BSON')) {
      return res.status(400).json({ message: 'Invalid book ID format' });
    }
    if (err.code === 11000) {
      return res.status(409).json({ 
        message: 'Book with this ISBN already exists' 
      });
    }
    res.status(500).json({ 
      message: err.message || 'An error occurred while updating the book' 
    });
  }
};

const deleteBook = async (req, res) => {
  // #swagger.tags = ['Books']
  try {
    if (!req.params.id) {
      return res.status(400).json({ message: 'Book ID is required' });
    }
    const bookId = new ObjectId(req.params.id);
    const existingBook = await mongodb.getDatabase().db('final-project').collection('books').findOne({ _id: bookId });
    if (!existingBook) {
      return res.status(404).json({ message: 'Book not found' });
    }
    const response = await mongodb.getDatabase().db('final-project').collection('books').deleteOne({ _id: bookId });
    if (response.deletedCount > 0) {
      res.status(200).json({ 
        message: 'Book deleted successfully',
        id: bookId
      });
    } else {
      res.status(500).json({ message: 'Failed to delete book' });
    }
  } catch (err) {
    if (err.message.includes('ObjectId') || err.message.includes('BSON')) {
      return res.status(400).json({ message: 'Invalid book ID format' });
    }
    res.status(500).json({ 
      message: err.message || 'An error occurred while deleting the book' 
    });
  }
};

module.exports = {
  getAllBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook
};