const express = require('express');
const router = express.Router();
const graphController = require('../controllers/graphController');

router.post('/', graphController.create);
router.get('/', graphController.findAll);
router.get('/:id', graphController.findById);
router.delete('/:id', graphController.delete);

module.exports = router;
