from django.db import migrations, models


def backfill_order_numbers(apps, schema_editor):
    HomeworkQuestion = apps.get_model("assessments", "HomeworkQuestion")
    CollectionQuestion = apps.get_model("assessments", "CollectionQuestion")

    # Homework: number within each (lesson, section) group.
    hw_groups = {}
    for q in HomeworkQuestion.objects.order_by("lesson_id", "section_id", "id").iterator():
        key = (q.lesson_id, q.section_id)
        hw_groups.setdefault(key, []).append(q.id)
    for ids in hw_groups.values():
        for i, qid in enumerate(ids, start=1):
            HomeworkQuestion.objects.filter(id=qid).update(order_number=i)

    # Collection: number within each (lesson, sub_lesson) group.
    cq_groups = {}
    for q in CollectionQuestion.objects.order_by("lesson_id", "sub_lesson_id", "id").iterator():
        key = (q.lesson_id, q.sub_lesson_id)
        cq_groups.setdefault(key, []).append(q.id)
    for ids in cq_groups.values():
        for i, qid in enumerate(ids, start=1):
            CollectionQuestion.objects.filter(id=qid).update(order_number=i)


class Migration(migrations.Migration):
    dependencies = [
        ("assessments", "0013_collection_sub_lessons"),
    ]

    operations = [
        migrations.AddField(
            model_name="homeworkquestion",
            name="order_number",
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="collectionquestion",
            name="order_number",
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AlterModelOptions(
            name="homeworkquestion",
            options={"ordering": ["lesson", "section", "order_number", "id"]},
        ),
        migrations.AlterModelOptions(
            name="collectionquestion",
            options={"ordering": ["lesson", "sub_lesson", "order_number", "id"]},
        ),
        migrations.RunPython(backfill_order_numbers, migrations.RunPython.noop),
    ]
