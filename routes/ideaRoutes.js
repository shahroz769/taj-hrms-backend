import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getAllIdeas,
  getIdeaById,
  createIdea,
  deleteIdea,
  updateIdea,
} from '../controllers/ideaController.js';

const router = express.Router();

// @route           GET /api/ideas
// @description     Get all ideas
// @access          Public
// @query           _limit (optional limit for ideas returned)
router.get('/', getAllIdeas);

// @route           GET /api/ideas/:id
// @description     Get single idea
// @access          Public
router.get('/:id', getIdeaById);

// @route           POST /api/ideas
// @description     Create new idea
// @access          Private
router.post('/', protect, createIdea);

// @route           DELETE /api/ideas/:id
// @description     Delete idea
// @access          Private
router.delete('/:id', protect, deleteIdea);

// @route           PUT /api/ideas/:id
// @description     Update idea
// @access          Private
router.put('/:id', protect, updateIdea);

export default router;
