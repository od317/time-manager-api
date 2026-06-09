-- CreateTable
CREATE TABLE "TimerState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timerMode" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimerState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TimerState_userId_key" ON "TimerState"("userId");

-- AddForeignKey
ALTER TABLE "TimerState" ADD CONSTRAINT "TimerState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
