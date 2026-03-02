import { Router } from 'express';
import { createReview } from './create.js';
import { listReviews } from './list.js';
import { reviewSummary } from './summary.js';
import { exportReview } from './export.js';
import { emailReview } from './email.js';

const reviews = Router();

reviews.use(createReview);
reviews.use(listReviews);
reviews.use(reviewSummary);
reviews.use(exportReview);
reviews.use(emailReview);

export { reviews };
