// @ts-nocheck
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedTeacher } from '../../auth/interfaces/jwt-payload.interface';
import {
  buildPaginationMeta,
  resolvePagination,
} from '../../common/dto/pagination-query.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { TeacherAccessService } from './teacher-access.service';
import { TeacherMessageResponseDto } from './dto/teacher-auth.dto';
import {
  TeacherGradeAssessmentDetailsDto,
  TeacherGradeAssessmentsResponseDto,
  TeacherGradeEntryContextDto,
  TeacherGradesQueryDto,
  TeacherGradeTypesResponseDto,
  UpsertTeacherGradeAssessmentDto,
} from './dto/teacher-grades.dto';
import {
  formatClassLabel,
  formatDateTime,
  formatFullName,
  parseDateOnly,
} from './teacher.util';

@Injectable()
export class TeacherGradesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teacherAccess: TeacherAccessService,
  ) {}

  async listGradeTypes(
    user: AuthenticatedTeacher,
  ): Promise<TeacherGradeTypesResponseDto> {
    this.teacherAccess.ensureTeacherRole(user);

    const items = await this.prisma.gradeType.findMany({
      where: {
        status: true,
        OR: [{ schoolId: user.schoolId }, { schoolId: null }],
      },
      select: { id: true, title: true },
      orderBy: [{ position: 'asc' }, { title: 'asc' }],
    });

    return { items };
  }

  async listAssessments(
    user: AuthenticatedTeacher,
    query: TeacherGradesQueryDto,
  ): Promise<TeacherGradeAssessmentsResponseDto> {
    this.teacherAccess.ensureTeacherRole(user);
    const { page, limit, skip } = resolvePagination(query);

    const where: Prisma.GradeWhereInput = {
      personId: user.id,
      schoolId: user.schoolId,
      ...(query.classId ? { sectionId: query.classId } : {}),
    };

    if (query.assignmentId) {
      const assignment = await this.teacherAccess.getAssignment(
        user,
        query.assignmentId,
      );
      where.sectionId = assignment.sectionId;
      where.courseId = assignment.courseId;
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.grade.count({ where }),
      this.prisma.grade.findMany({
        where,
        include: {
          course: { select: { id: true, title: true } },
          gradeType: { select: { title: true } },
          section: {
            select: {
              id: true,
              class: { select: { className: true } },
              sectionTitle: { select: { title: true } },
            },
          },
          _count: { select: { details: true } },
        },
        orderBy: [{ publishDate: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    const assignmentIds = await this.resolveAssignmentIds(
      user,
      rows.map((row) => ({
        sectionId: row.sectionId,
        courseId: row.courseId,
      })),
    );

    return {
      items: rows.map((row) => ({
        id: row.id,
        assignmentId:
          assignmentIds.get(this.key(row.sectionId, row.courseId)) ?? 0,
        classId: row.sectionId,
        classLabel: formatClassLabel(
          row.section.class.className,
          row.section.sectionTitle.title,
        ),
        courseTitle: row.course.title,
        title: row.title || row.gradeType.title,
        gradeTypeTitle: row.gradeType.title,
        maxGrade: Number(row.maxGrade),
        publishDate: row.publishDate ? formatDateTime(row.publishDate) : null,
        entriesCount: row._count.details,
      })),
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  async getEntryContext(
    user: AuthenticatedTeacher,
    assignmentId: number,
  ): Promise<TeacherGradeEntryContextDto> {
    const assignment = await this.teacherAccess.getAssignment(
      user,
      assignmentId,
    );

    const registrations = await this.prisma.registration.findMany({
      where: {
        sectionId: assignment.sectionId,
        schoolId: user.schoolId,
        status: true,
      },
      select: {
        student: {
          select: {
            id: true,
            person: {
              select: { firstName: true, middleName: true, lastName: true },
            },
          },
        },
      },
      orderBy: [
        { student: { person: { firstName: 'asc' } } },
        { student: { person: { lastName: 'asc' } } },
        { id: 'asc' },
      ],
    });

    return {
      assignmentId: assignment.id,
      classId: assignment.sectionId,
      classLabel: formatClassLabel(
        assignment.section.class.className,
        assignment.section.sectionTitle.title,
      ),
      courseTitle: assignment.course.title,
      students: registrations.map((registration, index) => ({
        id: registration.student.id,
        fullName: formatFullName(registration.student.person),
        seatNumber: index + 1,
      })),
    };
  }

  async getAssessment(
    user: AuthenticatedTeacher,
    assessmentId: number,
  ): Promise<TeacherGradeAssessmentDetailsDto> {
    const row = await this.findOwnAssessment(user, assessmentId);
    const assignmentId =
      (
        await this.prisma.teach.findFirst({
          where: {
            teacherId: user.teacherId,
            sectionId: row.sectionId,
            courseId: row.courseId,
          },
          select: { id: true },
        })
      )?.id ?? 0;

    return {
      assessmentId: row.id,
      assignmentId,
      title: row.title || row.gradeType.title,
      gradeTypeTitle: row.gradeType.title,
      maxGrade: Number(row.maxGrade),
      publishDate: row.publishDate ? formatDateTime(row.publishDate) : null,
      comment: row.comment,
      entries: row.details.map((detail) => ({
        studentId: detail.registration.studentId,
        score: detail.grade == null ? 0 : Number(detail.grade),
        comment: detail.comment ?? undefined,
      })),
    };
  }

  async createAssessment(
    user: AuthenticatedTeacher,
    dto: UpsertTeacherGradeAssessmentDto,
  ): Promise<TeacherGradeAssessmentDetailsDto> {
    const assignment = await this.assertWritableAssignment(user, dto);
    const gradeType = await this.resolveGradeType(user.schoolId, dto);
    const registrationByStudent = await this.loadSectionRegistrations(
      user.schoolId,
      assignment.sectionId,
      dto.entries.map((entry) => entry.studentId),
    );

    this.assertScores(dto);

    const createdId = await this.prisma.$transaction(async (tx) => {
      const created = await tx.grade.create({
        data: {
          schoolId: user.schoolId,
          sectionId: assignment.sectionId,
          courseId: assignment.courseId,
          gradeTypeId: gradeType.id,
          title: dto.title.trim(),
          maxGrade: dto.maxGrade,
          comment: dto.comment?.trim() || null,
          publishDate: parseDateOnly(dto.publishDate),
          personId: user.id,
        },
        select: { id: true },
      });

      await tx.gradeDetail.createMany({
        data: dto.entries.map((entry) => ({
          gradeId: created.id,
          registrationId: registrationByStudent.get(entry.studentId)!,
          grade: entry.score,
          comment: entry.comment?.trim() || null,
        })),
      });

      return created.id;
    });

    return this.getAssessment(user, createdId);
  }

  async updateAssessment(
    user: AuthenticatedTeacher,
    assessmentId: number,
    dto: UpsertTeacherGradeAssessmentDto,
  ): Promise<TeacherGradeAssessmentDetailsDto> {
    await this.findOwnAssessment(user, assessmentId);
    const assignment = await this.assertWritableAssignment(user, dto);
    const gradeType = await this.resolveGradeType(user.schoolId, dto);
    const registrationByStudent = await this.loadSectionRegistrations(
      user.schoolId,
      assignment.sectionId,
      dto.entries.map((entry) => entry.studentId),
    );
    this.assertScores(dto);

    await this.prisma.$transaction(async (tx) => {
      await tx.grade.update({
        where: { id: assessmentId },
        data: {
          sectionId: assignment.sectionId,
          courseId: assignment.courseId,
          gradeTypeId: gradeType.id,
          title: dto.title.trim(),
          maxGrade: dto.maxGrade,
          comment: dto.comment?.trim() || null,
          publishDate: parseDateOnly(dto.publishDate),
        },
      });

      await tx.gradeDetail.deleteMany({ where: { gradeId: assessmentId } });
      await tx.gradeDetail.createMany({
        data: dto.entries.map((entry) => ({
          gradeId: assessmentId,
          registrationId: registrationByStudent.get(entry.studentId)!,
          grade: entry.score,
          comment: entry.comment?.trim() || null,
        })),
      });
    });

    return this.getAssessment(user, assessmentId);
  }

  async deleteAssessment(
    user: AuthenticatedTeacher,
    assessmentId: number,
  ): Promise<TeacherMessageResponseDto> {
    await this.findOwnAssessment(user, assessmentId);
    await this.prisma.grade.delete({ where: { id: assessmentId } });
    return { message: 'Grade assessment deleted successfully' };
  }

  private async findOwnAssessment(
    user: AuthenticatedTeacher,
    assessmentId: number,
  ) {
    const row = await this.prisma.grade.findFirst({
      where: {
        id: assessmentId,
        personId: user.id,
        schoolId: user.schoolId,
      },
      include: {
        gradeType: { select: { title: true } },
        details: {
          select: {
            grade: true,
            comment: true,
            registration: { select: { studentId: true } },
          },
        },
      },
    });

    if (!row) {
      throw new NotFoundException('Grade assessment not found');
    }

    return row;
  }

  private async assertWritableAssignment(
    user: AuthenticatedTeacher,
    dto: UpsertTeacherGradeAssessmentDto,
  ) {
    const assignment = await this.teacherAccess.getAssignment(
      user,
      dto.assignmentId,
    );
    if (assignment.sectionId !== dto.classId) {
      throw new BadRequestException(
        'classId does not match the teaching assignment',
      );
    }
    return assignment;
  }

  private async resolveGradeType(
    schoolId: number,
    dto: UpsertTeacherGradeAssessmentDto,
  ) {
    if (dto.gradeTypeId) {
      const byId = await this.prisma.gradeType.findFirst({
        where: {
          id: dto.gradeTypeId,
          status: true,
          OR: [{ schoolId }, { schoolId: null }],
        },
        select: { id: true, title: true },
      });
      if (!byId) {
        throw new NotFoundException('Grade type not found');
      }
      return byId;
    }

    const title = dto.gradeTypeTitle.trim();
    const byTitle = await this.prisma.gradeType.findFirst({
      where: {
        status: true,
        title: { equals: title, mode: 'insensitive' },
        OR: [{ schoolId }, { schoolId: null }],
      },
      select: { id: true, title: true },
      orderBy: [{ schoolId: 'desc' }, { id: 'asc' }],
    });

    if (!byTitle) {
      throw new BadRequestException(
        `Unknown grade type "${title}". Use a school grade type.`,
      );
    }

    return byTitle;
  }

  private async loadSectionRegistrations(
    schoolId: number,
    sectionId: number,
    studentIds: number[],
  ) {
    const uniqueIds = [...new Set(studentIds)];
    const rows = await this.prisma.registration.findMany({
      where: {
        schoolId,
        sectionId,
        status: true,
        studentId: { in: uniqueIds },
      },
      select: { id: true, studentId: true },
    });

    if (rows.length !== uniqueIds.length) {
      throw new BadRequestException(
        'One or more students are not registered in this class',
      );
    }

    return new Map(rows.map((row) => [row.studentId, row.id]));
  }

  private assertScores(dto: UpsertTeacherGradeAssessmentDto) {
    for (const entry of dto.entries) {
      if (entry.score > dto.maxGrade) {
        throw new BadRequestException(
          `Score cannot be greater than max grade (${dto.maxGrade})`,
        );
      }
    }
  }

  private async resolveAssignmentIds(
    user: AuthenticatedTeacher,
    pairs: Array<{ sectionId: number; courseId: number }>,
  ) {
    if (pairs.length === 0) {
      return new Map<string, number>();
    }

    const rows = await this.prisma.teach.findMany({
      where: {
        teacherId: user.teacherId,
        OR: pairs.map((pair) => ({
          sectionId: pair.sectionId,
          courseId: pair.courseId,
        })),
      },
      select: { id: true, sectionId: true, courseId: true },
    });

    return new Map(
      rows.map((row) => [this.key(row.sectionId, row.courseId), row.id]),
    );
  }

  private key(sectionId: number, courseId: number): string {
    return `${sectionId}:${courseId}`;
  }
}
