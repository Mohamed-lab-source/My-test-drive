/// Fixed content: tracks, the track quiz and sample practice questions.
/// Check tracks and colleges against the official Ministry guide before launch.

class TrackInfo {
  const TrackInfo(this.nameAr, this.nameEn, this.collegesAr, this.collegesEn);

  final String nameAr;
  final String nameEn;
  final String collegesAr;
  final String collegesEn;
}

const List<TrackInfo> tracks = <TrackInfo>[
  TrackInfo('الطب وعلوم الحياة', 'Medicine & Life Sciences', 'طب · صيدلة · أسنان · وغيرها', 'Medicine · Pharmacy · Dentistry · and more'),
  TrackInfo('الهندسة وعلوم الحاسب', 'Engineering & Computer Science', 'هندسة · حاسبات ومعلومات · وغيرها', 'Engineering · Computers & IT · and more'),
  TrackInfo('الأعمال', 'Business', 'تجارة · اقتصاد · وغيرها', 'Commerce · Economics · and more'),
  TrackInfo('الآداب والفنون', 'Arts & Humanities', 'آداب · إعلام · حقوق · وغيرها', 'Arts · Media · Law · and more'),
];

class QuizQuestion {
  const QuizQuestion(this.qAr, this.qEn, this.optionsAr, this.optionsEn);

  final String qAr;
  final String qEn;

  /// Option i points to track i.
  final List<String> optionsAr;
  final List<String> optionsEn;
}

const List<QuizQuestion> trackQuiz = <QuizQuestion>[
  QuizQuestion(
    'إيه أكتر حاجة بتستمتع بيها؟',
    'What do you enjoy most?',
    <String>['أفهم جسم الإنسان والكائنات', 'أحل مسائل وأبني حاجات', 'أبيع وأدير وأخطط', 'أقرأ وأكتب وأناقش'],
    <String>['Understanding the human body', 'Solving problems and building things', 'Selling, managing, planning', 'Reading, writing, debating'],
  ),
  QuizQuestion(
    'أنهي مواد بتحس إنك أقوى فيها؟',
    'Which subjects feel strongest?',
    <String>['الأحياء والكيمياء', 'الرياضيات والفيزياء', 'الرياضيات والاقتصاد', 'العربي والتاريخ'],
    <String>['Biology & Chemistry', 'Math & Physics', 'Math & Economics', 'Arabic & History'],
  ),
  QuizQuestion(
    'تشوف نفسك فين بعد 10 سنين؟',
    'Where do you see yourself in 10 years?',
    <String>['في مستشفى أو معمل', 'في شركة تكنولوجيا', 'بدير شركتي', 'في الإعلام أو القانون'],
    <String>['In a hospital or lab', 'At a tech company', 'Running my own business', 'In media or law'],
  ),
];

class PracticeQuestion {
  const PracticeQuestion({
    required this.subjectAr,
    required this.subjectEn,
    required this.qAr,
    required this.qEn,
    required this.optionsAr,
    required this.optionsEn,
    required this.correct,
    required this.explainAr,
    required this.explainEn,
  });

  final String subjectAr;
  final String subjectEn;
  final String qAr;
  final String qEn;
  final List<String> optionsAr;
  final List<String> optionsEn;
  final int correct;
  final String explainAr;
  final String explainEn;
}

/// Sample questions for version 1. Replace with real curriculum questions later.
const List<PracticeQuestion> practiceQuestions = <PracticeQuestion>[
  PracticeQuestion(
    subjectAr: 'الرياضيات',
    subjectEn: 'Mathematics',
    qAr: 'لو f(x) = 2x + 3، يبقى f(4) كام؟',
    qEn: 'If f(x) = 2x + 3, what is f(4)?',
    optionsAr: <String>['8', '11', '14', '5'],
    optionsEn: <String>['8', '11', '14', '5'],
    correct: 1,
    explainAr: 'عوّض بـ 4 مكان x: ‏2 × 4 = 8، وبعدين 8 + 3 = 11.',
    explainEn: 'Put 4 in place of x: 2 × 4 = 8, then 8 + 3 = 11.',
  ),
  PracticeQuestion(
    subjectAr: 'الرياضيات',
    subjectEn: 'Mathematics',
    qAr: 'حل المعادلة: 3x − 6 = 9',
    qEn: 'Solve: 3x − 6 = 9',
    optionsAr: <String>['x = 5', 'x = 1', 'x = 3', 'x = −1'],
    optionsEn: <String>['x = 5', 'x = 1', 'x = 3', 'x = −1'],
    correct: 0,
    explainAr: 'زوّد 6 على الطرفين: 3x = 15، واقسم على 3: x = 5.',
    explainEn: 'Add 6 to both sides: 3x = 15, then divide by 3: x = 5.',
  ),
  PracticeQuestion(
    subjectAr: 'الرياضيات',
    subjectEn: 'Mathematics',
    qAr: 'كام 15% من 200؟',
    qEn: 'What is 15% of 200?',
    optionsAr: <String>['15', '30', '20', '35'],
    optionsEn: <String>['15', '30', '20', '35'],
    correct: 1,
    explainAr: '10% من 200 = 20، و5% = 10، يبقى 15% = 30.',
    explainEn: '10% of 200 is 20 and 5% is 10, so 15% is 30.',
  ),
  PracticeQuestion(
    subjectAr: 'الرياضيات',
    subjectEn: 'Mathematics',
    qAr: 'مساحة مستطيل طوله 8 وعرضه 5؟',
    qEn: 'Area of a rectangle 8 long and 5 wide?',
    optionsAr: <String>['13', '26', '40', '45'],
    optionsEn: <String>['13', '26', '40', '45'],
    correct: 2,
    explainAr: 'المساحة = الطول × العرض = 8 × 5 = 40.',
    explainEn: 'Area = length × width = 8 × 5 = 40.',
  ),
  PracticeQuestion(
    subjectAr: 'الفيزياء',
    subjectEn: 'Physics',
    qAr: 'عربية قطعت 120 كم في ساعتين. متوسط سرعتها كام؟',
    qEn: 'A car travels 120 km in 2 hours. What is its average speed?',
    optionsAr: <String>['60 كم/س', '240 كم/س', '100 كم/س', '120 كم/س'],
    optionsEn: <String>['60 km/h', '240 km/h', '100 km/h', '120 km/h'],
    correct: 0,
    explainAr: 'السرعة = المسافة ÷ الزمن = 120 ÷ 2 = 60 كم/س.',
    explainEn: 'Speed = distance ÷ time = 120 ÷ 2 = 60 km/h.',
  ),
  PracticeQuestion(
    subjectAr: 'الفيزياء',
    subjectEn: 'Physics',
    qAr: 'إيه وحدة قياس القوة؟',
    qEn: 'What is the unit of force?',
    optionsAr: <String>['النيوتن', 'الجول', 'الوات', 'الباسكال'],
    optionsEn: <String>['Newton', 'Joule', 'Watt', 'Pascal'],
    correct: 0,
    explainAr: 'القوة بتتقاس بالنيوتن. الجول للشغل، والوات للقدرة، والباسكال للضغط.',
    explainEn: 'Force is measured in newtons. Joules are for work, watts for power, pascals for pressure.',
  ),
  PracticeQuestion(
    subjectAr: 'الكيمياء',
    subjectEn: 'Chemistry',
    qAr: 'إيه الصيغة الكيميائية للمية؟',
    qEn: 'What is the chemical formula of water?',
    optionsAr: <String>['H₂O', 'CO₂', 'O₂', 'NaCl'],
    optionsEn: <String>['H₂O', 'CO₂', 'O₂', 'NaCl'],
    correct: 0,
    explainAr: 'المية = ذرتين هيدروجين + ذرة أكسجين = H₂O.',
    explainEn: 'Water is two hydrogen atoms and one oxygen atom: H₂O.',
  ),
  PracticeQuestion(
    subjectAr: 'اللغة الإنجليزية',
    subjectEn: 'English',
    qAr: 'اختار الصح: She ___ to school every day.',
    qEn: 'Choose the correct word: She ___ to school every day.',
    optionsAr: <String>['go', 'goes', 'going', 'gone'],
    optionsEn: <String>['go', 'goes', 'going', 'gone'],
    correct: 1,
    explainAr: 'مع she في المضارع البسيط بنزود s أو es للفعل: goes.',
    explainEn: 'With "she" in the present simple, the verb takes -s/-es: goes.',
  ),
];
