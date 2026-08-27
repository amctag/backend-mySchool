import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export async function purgeStudentAndPerson(
  tx: Prisma.TransactionClient,
  student: { id: number; personId: number },
): Promise<void> {
  await tx.gradeDetail.deleteMany({
    where: { registration: { studentId: student.id } },
  });
  await tx.registration.deleteMany({ where: { studentId: student.id } });
  await tx.attendanceDetail.deleteMany({ where: { studentId: student.id } });
  await tx.noticeStudent.deleteMany({ where: { studentId: student.id } });
  await tx.student.delete({ where: { id: student.id } });

  try {
    await tx.person.delete({ where: { id: student.personId } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new ConflictException(
        'This student is still linked to other school records and cannot be deleted',
      );
    }

    throw error;
  }
}
