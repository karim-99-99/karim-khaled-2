from django.db import migrations, models
import django.db.models.deletion


def migrate_content(apps, schema_editor):
    Lesson = apps.get_model("catalog", "Lesson")
    LessonSection = apps.get_model("catalog", "LessonSection")
    HomeworkQuestion = apps.get_model("assessments", "HomeworkQuestion")

    for lesson in Lesson.objects.all():
        has_hw = HomeworkQuestion.objects.filter(lesson_id=lesson.id).exists()
        if not (lesson.bunny_video_id or lesson.pdf_url or has_hw):
            continue
        sec = LessonSection.objects.filter(lesson_id=lesson.id).order_by("id").first()
        if not sec:
            sec = LessonSection.objects.create(
                lesson_id=lesson.id,
                title="حصة 1",
                order_number=1,
                bunny_video_id=lesson.bunny_video_id or "",
                pdf_url=lesson.pdf_url or "",
            )
        HomeworkQuestion.objects.filter(lesson_id=lesson.id, section_id__isnull=True).update(
            section_id=sec.id
        )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("assessments", "0006_exam_time_limit"),
        ("catalog", "0003_lessonsection"),
    ]

    operations = [
        migrations.AddField(
            model_name="homeworkquestion",
            name="section",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="homework_questions",
                to="catalog.lessonsection",
            ),
        ),
        migrations.AlterModelOptions(
            name="homeworkquestion",
            options={"ordering": ["lesson", "section", "id"]},
        ),
        migrations.RunPython(migrate_content, noop),
    ]
