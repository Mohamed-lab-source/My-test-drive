-- CreateTable
CREATE TABLE "RatingHelpfulVote" (
    "id" TEXT NOT NULL,
    "ratingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RatingHelpfulVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RatingHelpfulVote_ratingId_idx" ON "RatingHelpfulVote"("ratingId");

-- CreateIndex
CREATE UNIQUE INDEX "RatingHelpfulVote_ratingId_userId_key" ON "RatingHelpfulVote"("ratingId", "userId");

-- AddForeignKey
ALTER TABLE "RatingHelpfulVote" ADD CONSTRAINT "RatingHelpfulVote_ratingId_fkey" FOREIGN KEY ("ratingId") REFERENCES "Rating"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingHelpfulVote" ADD CONSTRAINT "RatingHelpfulVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
