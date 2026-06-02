from django.db import models


class WorkoutSession(models.Model):
    EXERCISE_CHOICES = [
        ('squat', '스쿼트'),
        ('lunge', '런지'),
        ('plank', '플랭크'),
        ('overhead_press', '오버헤드 프레스'),
    ]

    user_name = models.CharField(max_length=100)
    exercise = models.CharField(max_length=50, choices=EXERCISE_CHOICES)
    set_number = models.IntegerField()
    score = models.FloatField()          # 세트 평균 점수
    rep_scores = models.JSONField(default=list)  # rep별 점수 배열
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user_name} - {self.exercise} 세트{self.set_number} ({self.score}점)"


class RepClip(models.Model):
    EXERCISE_CHOICES = [
        ('squat', '스쿼트'),
        ('lunge', '런지'),
        ('plank', '플랭크'),
        ('overhead_press', '오버헤드 프레스'),
    ]
    session = models.ForeignKey(WorkoutSession, on_delete=models.CASCADE, related_name='clips', null=True, blank=True)
    user_name = models.CharField(max_length=100)
    exercise = models.CharField(max_length=50, choices=EXERCISE_CHOICES)
    rep_number = models.IntegerField()
    score = models.FloatField()
    video_file = models.FileField(upload_to='rep_clips/')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user_name} - {self.exercise} rep{self.rep_number} ({self.score}점)"
