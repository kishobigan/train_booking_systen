'use strict';
const Stripe = require('stripe');
const config = require('../config/stripe');
let client;
module.exports = function getStripe() {
  if (!config.enabled || !config.secretKey) throw new Error('Stripe payments are not configured');
  client ||= new Stripe(
    config.secretKey,
    config.apiVersion ? { apiVersion: config.apiVersion } : undefined
  );
  return client;
};
