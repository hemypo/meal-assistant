-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('SEDENTARY', 'LIGHT', 'MODERATE', 'HIGH', 'ATHLETE');

-- CreateEnum
CREATE TYPE "NutritionGoal" AS ENUM ('LOSE', 'MAINTAIN', 'GAIN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activityLevel" "ActivityLevel" NOT NULL DEFAULT 'MODERATE',
ADD COLUMN     "birthYear" INTEGER,
ADD COLUMN     "carbsTargetG" INTEGER,
ADD COLUMN     "fatTargetG" INTEGER,
ADD COLUMN     "goal" "NutritionGoal" NOT NULL DEFAULT 'MAINTAIN',
ADD COLUMN     "heightCm" INTEGER,
ADD COLUMN     "proteinTargetG" INTEGER,
ADD COLUMN     "sex" "Sex";
