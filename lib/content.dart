/// Fixed content: subjects, tracks, rules, exam calendar and the track quiz.
/// Based on Ministry of Education announcements as reported in Aug–Sep 2026.
/// Always re-check against official Ministry decisions before each school year.

const String rulesLastChecked = 'Nov 2026';

/// One subject of the Egyptian Baccalaureate.
class SubjectInfo {
  const SubjectInfo({
    required this.key,
    required this.nameAr,
    required this.nameEn,
    required this.yearAr,
    required this.yearEn,
    required this.counted,
    required this.aboutAr,
    required this.aboutEn,
    required this.tipsAr,
    required this.tipsEn,
  });

  final String key;
  final String nameAr;
  final String nameEn;
  final String yearAr;
  final String yearEn;
  final bool counted;
  final String aboutAr;
  final String aboutEn;
  final List<String> tipsAr;
  final List<String> tipsEn;
}

const List<String> _studyTipsAr = <String>[
  'ذاكر كل يوم شوية بدل ما تذاكر كتير مرة واحدة.',
  'حل أسئلة على كل درس بعد ما تخلصه على طول.',
  'اكتب الحاجات اللي بتغلط فيها وراجعها كل أسبوع.',
];

const List<String> _studyTipsEn = <String>[
  'Study a little every day instead of a lot at once.',
  'Solve questions on each lesson right after you finish it.',
  'Write down what you get wrong and review it every week.',
];

const List<SubjectInfo> subjectCatalog = <SubjectInfo>[
  // ---------- Year 2 core (all tracks) ----------
  SubjectInfo(
    key: 'arabic',
    nameAr: 'اللغة العربية',
    nameEn: 'Arabic',
    yearAr: 'تانية ثانوي · مادة أساسية لكل المسارات',
    yearEn: 'Year 2 · core subject for all tracks',
    counted: true,
    aboutAr: 'نحو وبلاغة وقراءة ونصوص وتعبير. من 100 درجة وبتدخل المجموع.',
    aboutEn: 'Grammar, rhetoric, reading, texts and writing. Out of 100 and counted in the total.',
    tipsAr: <String>['اعمل جدول بقواعد النحو وعلامات الإعراب وراجعه يومياً.', 'اكتب موضوع تعبير قصير كل أسبوع.', 'اقرأ النصوص بصوت عالي عشان تفهم المعنى.'],
    tipsEn: <String>['Keep a table of grammar rules and case endings and review it daily.', 'Write one short essay every week.', 'Read the texts out loud to understand the meaning.'],
  ),
  SubjectInfo(
    key: 'foreign1',
    nameAr: 'اللغة الأجنبية الأولى',
    nameEn: 'First foreign language',
    yearAr: 'تانية ثانوي · مادة أساسية لكل المسارات',
    yearEn: 'Year 2 · core subject for all tracks',
    counted: true,
    aboutAr: 'قواعد ومفردات وقراءة وكتابة. من 100 درجة وبتدخل المجموع.',
    aboutEn: 'Grammar, vocabulary, reading and writing. Out of 100 and counted in the total.',
    tipsAr: <String>['احفظ 10 كلمات جديدة كل يوم واستخدمها في جمل.', 'حل قطعة قراءة كل يوم.', 'اكتب برجراف قصير وصححه بنفسك.'],
    tipsEn: <String>['Learn 10 new words a day and use them in sentences.', 'Do one reading passage every day.', 'Write a short paragraph and check it yourself.'],
  ),
  SubjectInfo(
    key: 'history',
    nameAr: 'التاريخ المصري',
    nameEn: 'Egyptian history',
    yearAr: 'تانية ثانوي · مادة أساسية لكل المسارات',
    yearEn: 'Year 2 · core subject for all tracks',
    counted: true,
    aboutAr: 'تاريخ مصر وأحداثها وشخصياتها المهمة. من 100 درجة وبتدخل المجموع.',
    aboutEn: 'Egypt history, its key events and figures. Out of 100 and counted in the total.',
    tipsAr: <String>['اعمل خط زمني للأحداث بالتواريخ.', 'اربط كل حدث بسببه ونتيجته.', 'لخص كل درس في 5 نقط.'],
    tipsEn: <String>['Make a timeline of events with their dates.', 'Link every event to its cause and result.', 'Summarize each lesson in 5 points.'],
  ),

  // ---------- Year 2 track electives (choose one) ----------
  SubjectInfo(
    key: 'math',
    nameAr: 'الرياضيات',
    nameEn: 'Mathematics',
    yearAr: 'تانية ثانوي · اختيارية لمسار الطب وعلوم الحياة',
    yearEn: 'Year 2 · elective for Medicine & Life Sciences',
    counted: true,
    aboutAr: 'جبر ودوال وهندسة وحساب مثلثات. من 100 درجة.',
    aboutEn: 'Algebra, functions, geometry and trigonometry. Out of 100.',
    tipsAr: <String>['حل مسائل بإيدك كل يوم، الفهم لوحده مش كفاية.', 'اكتب القوانين في ورقة واحدة قدامك.', 'راجع المسائل اللي غلطت فيها مرة تانية بعد يومين.'],
    tipsEn: <String>['Solve problems by hand every day; understanding alone is not enough.', 'Keep all the formulas on one sheet in front of you.', 'Redo the problems you got wrong two days later.'],
  ),
  SubjectInfo(
    key: 'physics',
    nameAr: 'الفيزياء',
    nameEn: 'Physics',
    yearAr: 'تانية ثانوي · اختيارية لمسار الطب وعلوم الحياة',
    yearEn: 'Year 2 · elective for Medicine & Life Sciences',
    counted: true,
    aboutAr: 'حركة وقوى وطاقة وكهربية. من 100 درجة.',
    aboutEn: 'Motion, forces, energy and electricity. Out of 100.',
    tipsAr: <String>['افهم معنى كل قانون ووحدة قياسه.', 'ارسم المسألة قبل ما تحلها.', 'اتأكد من الوحدات في كل خطوة.'],
    tipsEn: <String>['Understand what every law means and its unit.', 'Draw the problem before solving it.', 'Check the units at every step.'],
  ),
  SubjectInfo(
    key: 'chemistry',
    nameAr: 'الكيمياء',
    nameEn: 'Chemistry',
    yearAr: 'تانية ثانوي · اختيارية لمسار الهندسة وعلوم الحاسب',
    yearEn: 'Year 2 · elective for Engineering & Computer Science',
    counted: true,
    aboutAr: 'تركيب المادة والعناصر والتفاعلات. من 100 درجة.',
    aboutEn: 'Structure of matter, elements and reactions. Out of 100.',
    tipsAr: <String>['احفظ رموز العناصر المشهورة.', 'اتدرب على وزن المعادلات.', 'اربط التفاعلات بأمثلة من الحياة.'],
    tipsEn: <String>['Learn the symbols of common elements.', 'Practise balancing equations.', 'Link reactions to everyday examples.'],
  ),
  SubjectInfo(
    key: 'programming',
    nameAr: 'البرمجة والذكاء الاصطناعي',
    nameEn: 'Programming & AI',
    yearAr: 'تانية ثانوي · اختيارية لمسار الهندسة وعلوم الحاسب',
    yearEn: 'Year 2 · elective for Engineering & Computer Science',
    counted: true,
    aboutAr: 'التفكير الخوارزمي وأساسيات البرمجة والذكاء الاصطناعي. من 100 درجة.',
    aboutEn: 'Algorithmic thinking, programming basics and AI. Out of 100.',
    tipsAr: <String>['اكتب كود بإيدك كل يوم ولو سطور قليلة.', 'تتبع الكود خطوة بخطوة على الورق.', 'قسّم أي مشكلة لخطوات صغيرة.'],
    tipsEn: <String>['Write some code every day, even a few lines.', 'Trace code step by step on paper.', 'Break every problem into small steps.'],
  ),
  SubjectInfo(
    key: 'accounting',
    nameAr: 'المحاسبة',
    nameEn: 'Accounting',
    yearAr: 'تانية ثانوي · اختيارية لمسار الأعمال',
    yearEn: 'Year 2 · elective for Business',
    counted: true,
    aboutAr: 'تسجيل العمليات المالية والقوائم المالية. من 100 درجة.',
    aboutEn: 'Recording financial transactions and financial statements. Out of 100.',
    tipsAr: <String>['احفظ المعادلة المحاسبية وافهمها كويس.', 'حل تمارين قيود يومية كتير.', 'اتأكد إن المدين يساوي الدائن دايماً.'],
    tipsEn: <String>['Learn and understand the accounting equation well.', 'Do many journal-entry exercises.', 'Always check that debits equal credits.'],
  ),
  SubjectInfo(
    key: 'business_admin',
    nameAr: 'إدارة الأعمال',
    nameEn: 'Business administration',
    yearAr: 'تانية ثانوي · اختيارية لمسار الأعمال',
    yearEn: 'Year 2 · elective for Business',
    counted: true,
    aboutAr: 'وظائف الإدارة والتسويق وريادة الأعمال. من 100 درجة.',
    aboutEn: 'Management functions, marketing and entrepreneurship. Out of 100.',
    tipsAr: <String>['اعمل خرائط ذهنية للمفاهيم.', 'طبّق كل مفهوم على شركة تعرفها.', 'اتدرب على أسئلة الحالات العملية.'],
    tipsEn: <String>['Make mind maps of the concepts.', 'Apply every concept to a company you know.', 'Practise case-study questions.'],
  ),
  SubjectInfo(
    key: 'psychology',
    nameAr: 'علم النفس',
    nameEn: 'Psychology',
    yearAr: 'تانية ثانوي · اختيارية لمسار الآداب والفنون',
    yearEn: 'Year 2 · elective for Arts & Humanities',
    counted: true,
    aboutAr: 'دراسة السلوك والعمليات العقلية. من 100 درجة.',
    aboutEn: 'The study of behaviour and mental processes. Out of 100.',
    tipsAr: <String>['احفظ أسماء العلماء ونظرياتهم في جدول.', 'هات مثال من الحياة لكل مفهوم.', 'اشرح الدرس لحد تاني بكلامك.'],
    tipsEn: <String>['Keep a table of scientists and their theories.', 'Find a real-life example for every concept.', 'Explain the lesson to someone in your own words.'],
  ),
  SubjectInfo(
    key: 'foreign2',
    nameAr: 'اللغة الأجنبية الثانية',
    nameEn: 'Second foreign language',
    yearAr: 'تانية ثانوي · اختيارية لمسار الآداب والفنون',
    yearEn: 'Year 2 · elective for Arts & Humanities',
    counted: true,
    aboutAr: 'زي الفرنساوي أو الألماني أو غيرهم حسب المدرسة. من 100 درجة لما تختارها في المسار.',
    aboutEn: 'For example French or German, depending on the school. Out of 100 when chosen in this track.',
    tipsAr: <String>['احفظ الأفعال الأساسية وتصريفها.', 'اسمع اللغة كل يوم ولو 10 دقايق.', 'اتدرب على جمل قصيرة.'],
    tipsEn: <String>['Learn the basic verbs and their forms.', 'Listen to the language for 10 minutes a day.', 'Practise short sentences.'],
  ),

  // ---------- Year 3 track subjects (two per track) ----------
  SubjectInfo(
    key: 'biology_adv',
    nameAr: 'الأحياء (مستوى رفيع)',
    nameEn: 'Biology (advanced)',
    yearAr: 'تالتة ثانوي · مسار الطب وعلوم الحياة',
    yearEn: 'Year 3 · Medicine & Life Sciences',
    counted: true,
    aboutAr: 'الخلية والوراثة وأجهزة الجسم. من 100 درجة.',
    aboutEn: 'Cells, genetics and body systems. Out of 100.',
    tipsAr: <String>['ارسم الرسومات وسمّي أجزاءها.', 'اعمل جداول مقارنة.', 'حل أسئلة تطبيقية مش حفظ بس.'],
    tipsEn: <String>['Draw the diagrams and label them.', 'Make comparison tables.', 'Solve applied questions, not only memorisation.'],
  ),
  SubjectInfo(
    key: 'chemistry_adv',
    nameAr: 'الكيمياء (مستوى رفيع)',
    nameEn: 'Chemistry (advanced)',
    yearAr: 'تالتة ثانوي · مسار الطب وعلوم الحياة',
    yearEn: 'Year 3 · Medicine & Life Sciences',
    counted: true,
    aboutAr: 'كيمياء متقدمة: تفاعلات وحسابات كيميائية. من 100 درجة.',
    aboutEn: 'Advanced chemistry: reactions and chemical calculations. Out of 100.',
    tipsAr: <String>['اتدرب على المسائل الحسابية كل يوم.', 'احفظ التفاعلات بشروطها.', 'راجع الجدول الدوري.'],
    tipsEn: <String>['Practise calculations every day.', 'Learn reactions with their conditions.', 'Review the periodic table.'],
  ),
  SubjectInfo(
    key: 'math_adv',
    nameAr: 'الرياضيات (مستوى رفيع)',
    nameEn: 'Mathematics (advanced)',
    yearAr: 'تالتة ثانوي · مسار الهندسة وعلوم الحاسب',
    yearEn: 'Year 3 · Engineering & Computer Science',
    counted: true,
    aboutAr: 'رياضيات متقدمة زي التفاضل والتكامل. من 100 درجة.',
    aboutEn: 'Advanced maths such as calculus. Out of 100.',
    tipsAr: <String>['حل مسائل متنوعة مش نوع واحد.', 'افهم الفكرة قبل القانون.', 'اعمل امتحانات بوقت.'],
    tipsEn: <String>['Solve varied problems, not one type only.', 'Understand the idea before the formula.', 'Do timed practice exams.'],
  ),
  SubjectInfo(
    key: 'physics_adv',
    nameAr: 'الفيزياء (مستوى رفيع)',
    nameEn: 'Physics (advanced)',
    yearAr: 'تالتة ثانوي · مسار الهندسة وعلوم الحاسب',
    yearEn: 'Year 3 · Engineering & Computer Science',
    counted: true,
    aboutAr: 'فيزياء متقدمة: كهربية ومغناطيسية وفيزياء حديثة. من 100 درجة.',
    aboutEn: 'Advanced physics: electricity, magnetism and modern physics. Out of 100.',
    tipsAr: <String>['اكتب المعطيات والمطلوب في كل مسألة.', 'افهم الرسومات البيانية.', 'راجع الوحدات والتحويلات.'],
    tipsEn: <String>['Write the givens and the unknown for every problem.', 'Understand the graphs.', 'Review units and conversions.'],
  ),
  SubjectInfo(
    key: 'economics_adv',
    nameAr: 'الاقتصاد (مستوى رفيع)',
    nameEn: 'Economics (advanced)',
    yearAr: 'تالتة ثانوي · مسار الأعمال',
    yearEn: 'Year 3 · Business',
    counted: true,
    aboutAr: 'العرض والطلب والأسواق والاقتصاد الكلي. من 100 درجة.',
    aboutEn: 'Supply and demand, markets and macroeconomics. Out of 100.',
    tipsAr: <String>['ارسم منحنيات العرض والطلب.', 'تابع أخبار الاقتصاد واربطها بالدروس.', 'احفظ التعريفات بدقة.'],
    tipsEn: <String>['Draw supply and demand curves.', 'Follow economic news and link it to lessons.', 'Learn definitions exactly.'],
  ),
  SubjectInfo(
    key: 'math3',
    nameAr: 'الرياضيات',
    nameEn: 'Mathematics',
    yearAr: 'تالتة ثانوي · مسار الأعمال',
    yearEn: 'Year 3 · Business',
    counted: true,
    aboutAr: 'رياضيات لمسار الأعمال. من 100 درجة.',
    aboutEn: 'Mathematics for the Business track. Out of 100.',
    tipsAr: <String>['حل مسائل كل يوم.', 'اكتب القوانين في ورقة واحدة.', 'راجع أخطاءك.'],
    tipsEn: <String>['Solve problems every day.', 'Keep formulas on one sheet.', 'Review your mistakes.'],
  ),
  SubjectInfo(
    key: 'geography_adv',
    nameAr: 'الجغرافيا (مستوى رفيع)',
    nameEn: 'Geography (advanced)',
    yearAr: 'تالتة ثانوي · مسار الآداب والفنون',
    yearEn: 'Year 3 · Arts & Humanities',
    counted: true,
    aboutAr: 'جغرافيا طبيعية وبشرية والخرائط. من 100 درجة.',
    aboutEn: 'Physical and human geography and maps. Out of 100.',
    tipsAr: <String>['ذاكر بالخريطة دايماً.', 'اربط الظواهر بأسبابها.', 'لخص في جداول.'],
    tipsEn: <String>['Always study with a map.', 'Link each phenomenon to its causes.', 'Summarise in tables.'],
  ),
  SubjectInfo(
    key: 'statistics',
    nameAr: 'الإحصاء',
    nameEn: 'Statistics',
    yearAr: 'تالتة ثانوي · مسار الآداب والفنون',
    yearEn: 'Year 3 · Arts & Humanities',
    counted: true,
    aboutAr: 'جمع البيانات وتحليلها والاحتمالات. من 100 درجة.',
    aboutEn: 'Collecting and analysing data, and probability. Out of 100.',
    tipsAr: <String>['حل مسائل على المتوسط والوسيط والمنوال.', 'اقرا الرسوم البيانية كويس.', 'اتدرب على الاحتمالات.'],
    tipsEn: <String>['Practise mean, median and mode.', 'Read charts carefully.', 'Practise probability.'],
  ),

  // ---------- Outside the total ----------
  SubjectInfo(
    key: 'religion',
    nameAr: 'التربية الدينية',
    nameEn: 'Religious education',
    yearAr: 'خارج المجموع · لازم تنجح فيها',
    yearEn: 'Outside the total · you must pass it',
    counted: false,
    aboutAr: 'مش بتدخل المجموع، بس لازم تجيب 70% على الأقل عشان تنجح.',
    aboutEn: 'Not counted in the total, but you must score at least 70% to pass.',
    tipsAr: <String>['ما تستهونش بيها: 70% شرط للنجاح.', 'ذاكرها بانتظام زي باقي المواد.'],
    tipsEn: <String>['Do not underestimate it: 70% is required to pass.', 'Study it regularly like other subjects.'],
  ),
  SubjectInfo(
    key: 'financial',
    nameAr: 'الثقافة المالية',
    nameEn: 'Financial literacy',
    yearAr: 'تانية ثانوي · خارج المجموع',
    yearEn: 'Year 2 · outside the total',
    counted: false,
    aboutAr: 'لكل المسارات. مش بتدخل المجموع، واللي ينجح ياخد شهادة إتمام.',
    aboutEn: 'For all tracks. Not counted in the total; students who pass get a completion certificate.',
    tipsAr: <String>['طبّق اللي بتتعلمه على مصروفك.', 'افهم الفرق بين الادخار والاستثمار.'],
    tipsEn: <String>['Apply what you learn to your own pocket money.', 'Understand the difference between saving and investing.'],
  ),
  SubjectInfo(
    key: 'pe',
    nameAr: 'التربية الرياضية',
    nameEn: 'Physical education',
    yearAr: 'خارج المجموع · امتحان عملي',
    yearEn: 'Outside the total · practical exam',
    counted: false,
    aboutAr: 'نشاط رياضي بامتحان عملي بس، ومش بيدخل المجموع.',
    aboutEn: 'A sports activity with a practical exam only, not counted in the total.',
    tipsAr: <String>['الرياضة بتساعدك تركز أكتر في المذاكرة.'],
    tipsEn: <String>['Exercise helps you focus better when studying.'],
  ),
];

SubjectInfo? subjectInfo(String? key) {
  for (final s in subjectCatalog) {
    if (s.key == key) return s;
  }
  return null;
}

/// The four tracks.
class TrackInfo {
  const TrackInfo({
    required this.nameAr,
    required this.nameEn,
    required this.fieldsAr,
    required this.fieldsEn,
    required this.electives,
    required this.year3,
  });

  final String nameAr;
  final String nameEn;
  final String fieldsAr;
  final String fieldsEn;

  /// Year 2: the student picks ONE of these.
  final List<String> electives;

  /// Year 3: both of these.
  final List<String> year3;
}

const List<String> year2Core = <String>['arabic', 'foreign1', 'history'];

const List<TrackInfo> tracks = <TrackInfo>[
  TrackInfo(
    nameAr: 'الطب وعلوم الحياة',
    nameEn: 'Medicine & Life Sciences',
    fieldsAr: 'المجالات الطبية والعلمية وعلوم الحياة',
    fieldsEn: 'Medical, scientific and life-science fields',
    electives: <String>['math', 'physics'],
    year3: <String>['biology_adv', 'chemistry_adv'],
  ),
  TrackInfo(
    nameAr: 'الهندسة وعلوم الحاسب',
    nameEn: 'Engineering & Computer Science',
    fieldsAr: 'الهندسة والبرمجة وتكنولوجيا المعلومات وعلوم الحاسب',
    fieldsEn: 'Engineering, programming, IT and computer science',
    electives: <String>['chemistry', 'programming'],
    year3: <String>['math_adv', 'physics_adv'],
  ),
  TrackInfo(
    nameAr: 'الأعمال',
    nameEn: 'Business',
    fieldsAr: 'الإدارة والاقتصاد والمحاسبة والقطاع المالي والتجاري',
    fieldsEn: 'Management, economics, accounting, finance and commerce',
    electives: <String>['accounting', 'business_admin'],
    year3: <String>['economics_adv', 'math3'],
  ),
  TrackInfo(
    nameAr: 'الآداب والفنون',
    nameEn: 'Arts & Humanities',
    fieldsAr: 'العلوم الإنسانية والاجتماعية والثقافة والفنون',
    fieldsEn: 'Humanities, social sciences, culture and the arts',
    electives: <String>['psychology', 'foreign2'],
    year3: <String>['geography_adv', 'statistics'],
  ),
];

/// A rule of the system, shown in the Guide.
class RuleInfo {
  const RuleInfo(this.titleAr, this.titleEn, this.bodyAr, this.bodyEn);

  final String titleAr;
  final String titleEn;
  final String bodyAr;
  final String bodyEn;
}

const List<RuleInfo> rules = <RuleInfo>[
  RuleInfo('نظام اختياري', 'An optional system',
      'البكالوريا المصرية بديل اختياري للثانوية العامة. أولى ثانوي مرحلة تمهيدية، وتانية وتالتة هما المرحلة الرئيسية.',
      'The Egyptian Baccalaureate is an optional alternative to Thanaweya Amma. Year 1 is a foundation stage; Years 2 and 3 are the main stage.'),
  RuleInfo('المجموع من 600', 'The total is out of 600',
      'كل مادة من 100. أربع مواد في تانية ثانوي (400) + مادتين في تالتة ثانوي (200) = 600.',
      'Each subject is out of 100. Four subjects in Year 2 (400) plus two in Year 3 (200) = 600.'),
  RuleInfo('أعلى درجة هي اللي بتتحسب', 'Your best score counts',
      'لو دخلت امتحان المادة أكتر من مرة، أعلى درجة بس هي اللي بتتحسب، وكل المحاولات بتتسجل.',
      'If you sit a subject more than once, only your highest score counts. All attempts are recorded.'),
  RuleInfo('مواعيد المحاولات', 'When the attempts happen',
      'تانية ثانوي: المحاولة الأولى إجبارية ومجانية في مايو، والتانية اختيارية في يوليو.\nتالتة ثانوي: الأولى إجبارية ومجانية في يونيو، والتانية اختيارية في أغسطس.\nطالب تالتة يقدر يعيد مواد تانية في دور مايو أو يوليو. والتحسين متاح على مدار 4 سنين دراسية حسب اللائحة.',
      'Year 2: first attempt is compulsory and free in May; the second is optional in July.\nYear 3: first attempt is compulsory and free in June; the second is optional in August.\nYear 3 students can retake Year 2 subjects in the May or July session. Improvement is possible across up to four school years, under the regulations.'),
  RuleInfo('الرسوم', 'Fees',
      'المحاولة الأولى مجانية. المحاولة الاختيارية بـ 200 جنيه للمادة. اللي عنده عذر مقبول (مرض أو ظرف قهري) ممكن ياخد محاولة تانية مجانية حسب الإجراءات.',
      'The first attempt is free. An optional attempt costs 200 EGP per subject. Students with an accepted excuse (illness or force majeure) may get a free second attempt, under the procedures.'),
  RuleInfo('شرط 60% من التقييمات', 'The 60% assessments rule',
      'من 2026/2027 لازم تكمّل 60% على الأقل من التقييمات المطلوبة في كل مادة عشان تدخل امتحان المحاولة الأولى. ده شرط إكمال، مش درجة 60%.',
      'From 2026/2027 you must complete at least 60% of the required assessments in each subject to sit the first-attempt exam. This is about completion, not scoring 60%.'),
  RuleInfo('التربية الدينية', 'Religious education',
      'مش بتدخل المجموع، بس لازم تجيب 70% على الأقل عشان تنجح.',
      'It is not added to the total, but you must score at least 70% to pass.'),
  RuleInfo('مواد خارج المجموع', 'Subjects outside the total',
      'الثقافة المالية (واللي ينجح ياخد شهادة إتمام) والتربية الرياضية (امتحان عملي) مش بيدخلوا المجموع.',
      'Financial literacy (passing gives a completion certificate) and physical education (practical exam) are not added to the total.'),
  RuleInfo('تغيير المسار', 'Changing track',
      'مسموح لطالب تالتة ثانوي. لازم يذاكر المادة التخصصية بتاعة تانية ثانوي في المسار الجديد، ومادتين تالتة ثانوي بتوعه.',
      'Allowed for Year 3 students. You must study the new track Year 2 specialised subject plus its two Year 3 subjects.'),
  RuleInfo('شكل امتحان تالتة', 'Year 3 exam format',
      'حسب المنشور، امتحانات تالتة ثانوي من 2026/2027 بتكون 50% اختيار من متعدد و50% مقالي.',
      'As reported, Year 3 exams from 2026/2027 are 50% multiple choice and 50% essay.'),
  RuleInfo('التنسيق ودخول الجامعة', 'University admission',
      'درجاتك ومحاولاتك بتتبعت لمكتب التنسيق. قواعد القبول والحدود الدنيا لكل مسار لسه ما اتعلنتش بالتفصيل، فما تفترضش إنها زي الثانوية العامة. واختيار المسار مش بيضمن كلية معينة.',
      'Your scores and attempts are sent to the coordination office. Detailed admission rules and minimum scores per track have not been fully announced, so do not assume they match Thanaweya Amma. Choosing a track does not guarantee a specific faculty.'),
];

/// Exam calendar (months), shown in the Guide.
class ExamWindow {
  const ExamWindow(this.monthAr, this.monthEn, this.whatAr, this.whatEn, this.free);

  final String monthAr;
  final String monthEn;
  final String whatAr;
  final String whatEn;
  final bool free;
}

const List<ExamWindow> examCalendar = <ExamWindow>[
  ExamWindow('مايو', 'May', 'تانية ثانوي · المحاولة الأولى (إجبارية)', 'Year 2 · first attempt (compulsory)', true),
  ExamWindow('يونيو', 'June', 'تالتة ثانوي · المحاولة الأولى (إجبارية)', 'Year 3 · first attempt (compulsory)', true),
  ExamWindow('يوليو', 'July', 'تانية ثانوي · المحاولة الاختيارية', 'Year 2 · optional attempt', false),
  ExamWindow('أغسطس', 'August', 'تالتة ثانوي · المحاولة الاختيارية', 'Year 3 · optional attempt', false),
];

/// Track quiz: option i of every question points to track i.
class QuizQuestion {
  const QuizQuestion(this.qAr, this.qEn, this.optionsAr, this.optionsEn);

  final String qAr;
  final String qEn;
  final List<String> optionsAr;
  final List<String> optionsEn;
}

const List<QuizQuestion> trackQuiz = <QuizQuestion>[
  QuizQuestion('إيه أكتر حاجة بتستمتع بيها؟', 'What do you enjoy most?',
      <String>['أفهم جسم الإنسان والكائنات', 'أحل مسائل وأبني حاجات', 'أبيع وأدير وأخطط', 'أقرأ وأكتب وأناقش'],
      <String>['Understanding the human body', 'Solving problems and building things', 'Selling, managing, planning', 'Reading, writing, debating']),
  QuizQuestion('أنهي مواد بتحس إنك أقوى فيها؟', 'Which subjects feel strongest?',
      <String>['الأحياء والكيمياء', 'الرياضيات والفيزياء', 'الرياضيات والاقتصاد', 'العربي والتاريخ'],
      <String>['Biology & Chemistry', 'Math & Physics', 'Math & Economics', 'Arabic & History']),
  QuizQuestion('تشوف نفسك فين بعد 10 سنين؟', 'Where do you see yourself in 10 years?',
      <String>['في مستشفى أو معمل', 'في شركة تكنولوجيا', 'بدير شركتي', 'في الإعلام أو القانون'],
      <String>['In a hospital or lab', 'At a tech company', 'Running my own business', 'In media or law']),
  QuizQuestion('أنهي نشاط تختاره في إجازة؟', 'Which activity would you pick on a day off?',
      <String>['تجربة علمية أو فيديو عن الصحة', 'أصلح جهاز أو أعمل لعبة كمبيوتر', 'أبيع حاجة أونلاين وأحسب المكسب', 'أقرا رواية أو أرسم أو أكتب'],
      <String>['A science experiment or a health video', 'Fix a gadget or make a computer game', 'Sell something online and count the profit', 'Read a novel, draw or write']),
  QuizQuestion('صاحبك محتاج مساعدة في إيه بيجيلك؟', 'What do friends usually ask your help with?',
      <String>['لما حد تعبان أو عنده سؤال صحي', 'لما الموبايل أو الكمبيوتر يبوظ', 'لما يحتاج ينظم فلوسه أو مشروع', 'لما يكتب بوست أو موضوع تعبير'],
      <String>['When someone is ill or has a health question', 'When their phone or computer breaks', 'When they need to manage money or a project', 'When they write a post or an essay']),
];

/// Study tips shown under every subject guide.
List<String> generalTips(bool arabic) => arabic ? _studyTipsAr : _studyTipsEn;
