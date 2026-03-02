-- CreateTable
CREATE TABLE "ReviewGoal" (
    "reviewId" VARCHAR(36) NOT NULL,
    "goalId" VARCHAR(36) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewGoal_pkey" PRIMARY KEY ("reviewId","goalId")
);

-- AddForeignKey
ALTER TABLE "ReviewGoal" ADD CONSTRAINT "ReviewGoal_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewGoal" ADD CONSTRAINT "ReviewGoal_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
