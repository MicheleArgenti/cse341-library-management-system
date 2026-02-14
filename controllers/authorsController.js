// controllers/authorsController.js
const mongodb = require('../data/database');
const { ObjectId } = require('mongodb');

const getAllAuthors = async (req, res) => {
  // #swagger.tags = ['Authors']
  try {
    const result = await mongodb.getDatabase().db('final-project').collection('authors').find();
    const authors = await result.toArray();
    res.setHeader('Content-type', 'application/json');
    res.status(200).json(authors);
  } catch (err) {
    res.status(500).json({ message: err.message || 'An error occurred while getting all authors' });
  }
};

const getAuthorById = async (req, res) => {
  // #swagger.tags = ['Authors']
  try {
    if (!req.params.id) {
      return res.status(400).json({ message: 'Author ID is required' });
    }
    const authorId = new ObjectId(req.params.id);
    const result = await mongodb.getDatabase().db('final-project').collection('authors').find({ _id: authorId });
    const authors = await result.toArray();
    if (authors.length === 0) {
      return res.status(404).json({ message: 'Author not found' });
    }
    res.setHeader('Content-type', 'application/json');
    res.status(200).json(authors[0]);
  } catch (err) {
    if (err.message.includes('ObjectId') || err.message.includes('BSON')) {
      return res.status(400).json({ message: 'Invalid author ID format' });
    }
    res.status(500).json({ message: err.message || 'An error occurred while getting the author' });
  }
};

const createAuthor = async (req, res) => {
  // #swagger.tags = ['Authors']
  try {
    const requiredFields = ['firstName', 'lastName', 'nationality', 'birthDate'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }
    if (req.body.notableWorks && !Array.isArray(req.body.notableWorks)) {
      return res.status(400).json({ message: 'notableWorks must be an array' });
    }
    if (isNaN(Date.parse(req.body.birthDate))) {
      return res.status(400).json({ message: 'Invalid birthDate format. Use YYYY-MM-DD' });
    }
    if (req.body.deathDate && isNaN(Date.parse(req.body.deathDate))) {
      return res.status(400).json({ message: 'Invalid deathDate format. Use YYYY-MM-DD' });
    }
    const author = {
      firstName: req.body.firstName.trim(),
      lastName: req.body.lastName.trim(),
      birthDate: req.body.birthDate,
      deathDate: req.body.deathDate || null,
      nationality: req.body.nationality.trim(),
      biography: req.body.biography || '',
      notableWorks: req.body.notableWorks || [],
      createdAt: new Date()
    };
    const response = await mongodb.getDatabase().db('final-project').collection('authors').insertOne(author);
    if (response.acknowledged) {
      res.status(201).json({
        id: response.insertedId,
        message: 'Author created successfully',
        author: author
      });
    } else {
      res.status(500).json({ message: 'Failed to create author' });
    }
  } catch (err) {
    res.status(500).json({ 
      message: err.message || 'An error occurred while creating the author' 
    });
  }
};

const updateAuthor = async (req, res) => {
  // #swagger.tags = ['Authors']
  try {
    if (!req.params.id) {
      return res.status(400).json({ message: 'Author ID is required' });
    }
    const authorId = new ObjectId(req.params.id);
    const existingAuthor = await mongodb.getDatabase().db('final-project').collection('authors').findOne({ _id: authorId });
    if (!existingAuthor) {
      return res.status(404).json({ message: 'Author not found' });
    }
    const updateData = {};
    if (req.body.firstName) updateData.firstName = req.body.firstName.trim();
    if (req.body.lastName) updateData.lastName = req.body.lastName.trim();
    if (req.body.birthDate) {
      if (isNaN(Date.parse(req.body.birthDate))) {
        return res.status(400).json({ message: 'Invalid birthDate format. Use YYYY-MM-DD' });
      }
      updateData.birthDate = req.body.birthDate;
    }
    if (req.body.deathDate !== undefined) {
      if (req.body.deathDate && isNaN(Date.parse(req.body.deathDate))) {
        return res.status(400).json({ message: 'Invalid deathDate format. Use YYYY-MM-DD' });
      }
      updateData.deathDate = req.body.deathDate || null;
    }
    if (req.body.nationality) updateData.nationality = req.body.nationality.trim();
    if (req.body.biography !== undefined) updateData.biography = req.body.biography;
    if (req.body.notableWorks) {
      if (!Array.isArray(req.body.notableWorks)) {
        return res.status(400).json({ message: 'notableWorks must be an array' });
      }
      updateData.notableWorks = req.body.notableWorks;
    }
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No fields to update provided' });
    }
    const response = await mongodb.getDatabase().db('final-project').collection('authors').updateOne(
      { _id: authorId },
      { $set: updateData }
    );
    if (response.modifiedCount > 0) {
      const updatedAuthor = await mongodb.getDatabase().db('final-project').collection('authors').findOne({ _id: authorId });
      res.status(200).json({ 
        message: 'Author updated successfully',
        author: updatedAuthor
      });
    } else {
      res.status(200).json({ message: 'No changes made to the author' });
    }
  } catch (err) {
    if (err.message.includes('ObjectId') || err.message.includes('BSON')) {
      return res.status(400).json({ message: 'Invalid author ID format' });
    }
    res.status(500).json({ 
      message: err.message || 'An error occurred while updating the author' 
    });
  }
};

const deleteAuthor = async (req, res) => {
  // #swagger.tags = ['Authors']
  try {
    if (!req.params.id) {
      return res.status(400).json({ message: 'Author ID is required' });
    }
    const authorId = new ObjectId(req.params.id);
    const existingAuthor = await mongodb.getDatabase().db('final-project').collection('authors').findOne({ _id: authorId });
    if (!existingAuthor) {
      return res.status(404).json({ message: 'Author not found' });
    }
    const booksByAuthor = await mongodb.getDatabase().db('final-project').collection('books').find({ author: existingAuthor.name }).toArray();
    if (booksByAuthor.length > 0) {
      return res.status(409).json({ 
        message: 'Cannot delete author with existing books. Please delete or reassign books first.',
        booksCount: booksByAuthor.length
      });
    }
    const response = await mongodb.getDatabase().db('final-project').collection('authors').deleteOne({ _id: authorId });
    if (response.deletedCount > 0) {
      res.status(200).json({ 
        message: 'Author deleted successfully',
        id: authorId
      });
    } else {
      res.status(500).json({ message: 'Failed to delete author' });
    }
  } catch (err) {
    if (err.message.includes('ObjectId') || err.message.includes('BSON')) {
      return res.status(400).json({ message: 'Invalid author ID format' });
    }
    res.status(500).json({ 
      message: err.message || 'An error occurred while deleting the author' 
    });
  }
};

module.exports = {
  getAllAuthors,
  getAuthorById,
  createAuthor,
  updateAuthor,
  deleteAuthor
};