const express = require('express');
const router = express.Router();
const dantzigController = require('../controllers/dantzigController');

router.post('/run', dantzigController.run);
router.post('/simulations', dantzigController.saveSimulation);
router.get('/simulations', dantzigController.getAllSimulations);
router.get('/simulations/:id', dantzigController.getSimulation);

module.exports = router;
