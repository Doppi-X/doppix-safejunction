# Do'ppiX SafeJunction — jamoa uchun to'liq qo'llanma

> Bu hujjat taqdimot qiladigan jamoadoshlar uchun. Uni o'qigan odam loyihani to'liq tushuntira oladi va hakamlarning savollariga javob bera oladi. Yangi funksiya qo'shilsa, hujjat yangilanadi.

---

## 1. Bir gapda

**SafeJunction shahardagi istalgan yo'l kamerasini yo'l xavfsizligi auditoriga aylantiradi.** Kamera videosini oladi. Qizil chiroqda o'tish, piyodaga yo'l bermaslik, qarama-qarshi harakat, xavfli yaqinlashuvlarni topadi. Yo'l muhandisiga **"nimani o'zgartirish kerak"** degan tavsiya beradi. Yuz va raqamlar xiralashtiriladi.

- **Rejim:** Startup (o'z mijozlari va daromadi bo'lgan mustaqil mahsulot)
- **Mijoz:** shahar yo'l harakati xavfsizligi bo'limi (B2G obuna). Ikkinchi mijoz: sug'urta kompaniyalari.
- **Foydalanuvchi:** tuman yo'l harakati muhandisi. U qayerda svetofor, chiziq yoki piyoda o'tish joyini o'zgartirishni hal qiladi.

---

## 2. Muammo (nega kerak)

- Hozir shahar qaysi chorraha xavfli ekanini **avariya bo'lgandan keyin** biladi. Statistika faqat avariyalarni sanaydi.
- Kameralar bor va yozib turadi, lekin hech kim ularni xavf uchun tahlil qilmaydi.
- **Bizning dalilimiz.** Bitta Toshkent chorrahasining 18.4 daqiqalik videosini **o'zimiz qo'lda labelladik**:

| Nima ko'rdik | Soni | Soatiga |
|---|---|---|
| Piyoda zebradan tashqarida yo'lda | 16 | 52 |
| Mashina piyodaga yo'l bermadi | 9 | 29 |
| Qizilda zebra ustida to'xtagan mashina | 6 | 20 |
| Qizil chiroqda o'tish | 2 | 7 |

Hech kim jarohatlanmadi, shuning uchun bularning birortasi statistikaga tushmagan. Bizning tizim aynan shuni ko'rsatadi: **avariyadan oldingi xavf**.

---

## 3. Mahsulot qanday ishlatiladi (foydalanuvchi ko'zi bilan)

1. Saytga kiradi: **giyos1212-safejunction.static.hf.space**
2. **"Try it"** → video (yoki rasm) yuklaydi. Videoning birinchi 2 daqiqasi tahlil qilinadi.
3. Video ishlanayotganda **xohlasa** birinchi kadrda chizadi:
   - **Road:** yo'l chegarasi. Chizilmasa, tizim o'zi o'rganadi.
   - **Crosswalk:** zebra.
   - **Stop line:** stop-chiziq (2 marta bosish).
   - **Traffic light:** svetofor atrofida to'rtburchak (2 marta bosish).

   Chizilgan zonalar avtomatik saqlanadi.
4. Natija:
   - **Safety report:** nechta hodisa, soatiga nechta, qancha vaqt davom etgani.
   - **What to change:** tavsiyalar, masalan "piyodaga 3–5 soniya oldin yashil bering".
   - **Video:** boxlar, hodisa ishtirokchilari rangli ramkada, yuz va raqamlar xira.
   - **Learned lane directions** tugmasi: tizim o'rgangan harakat yo'nalishlari (ko'k strelkalar).
   - **Hotspot map (xavf xaritasi):** kamera kadrida har bir hodisa ishtirokchisi turgan joy nuqta bilan ko'rsatiladi. Nuqtalar to'plangan joy ko'chaning birinchi o'zgartirish kerak bo'lgan joyi.
   - **PDF report:** muhandis uchun bir sahifalik hisobot. Unda raqamlar, xarita, tavsiyalar va hodisalar ro'yxati bor. Uni chop etsa yoki boshliqqa yuborsa bo'ladi.
   - **Events CSV / Full JSON:** yuklab olish.
5. Hisobotdan keyin zonalarni o'zgartirib, **qayta hisoblash** mumkin. Bu bir necha soniya oladi, video qayta ishlanmaydi.
6. **City dashboard (shahar paneli):** tahlil qilingan har bir kamera shu yerga tushadi.
   - Kameralar **risk index** bo'yicha tartiblanadi. Risk index = og'irlik bilan hisoblangan "10 daqiqada nechta hodisa". Og'irliklar: qizilda o'tish, qarama-qarshi harakat, piyodaga yo'l bermaslik, xavfli yaqinlashuv ×3; piyoda yo'lda ×2; qolganlari ×1.
   - Kamerani bossangiz, uning xavf xaritasi va hodisa turlari ko'rinadi.
   - **Before / after:** bitta kamerani o'zgartirishdan oldin va keyin yuklab, ikkalasini taqqoslash mumkin, masalan svetofor vaqti o'zgargandan keyin. Natija har bir hodisa turi bo'yicha foiz o'zgarishi bilan chiqadi. Pilot aynan shu bilan o'z foydasini isbotlaydi.
   - Dashboard'da faqat raqamlar va xiralashtirilgan bitta kadr saqlanadi, video 6 soatda o'chadi.
   - Hakam yuklagan video ham darhol dashboard'da paydo bo'ladi. Demo uchun yaxshi moment.

**Uch xil rejim** (tizim o'zi tanlaydi):

| Rejim | Qachon | Nima topadi |
|---|---|---|
| **Zero-config** (zonasiz) | Kamera yangi, zona chizilmagan | Qarama-qarshi harakat, to'xtab qolgan mashina, tirbandlik, xavfli yaqinlashuv |
| **Zones drawn** | Foydalanuvchi zona chizgan | Yuqoridagilar + qizilda o'tish, stop-chiziq, piyoda yo'lda, piyodaga yo'l bermaslik |
| **Known camera** | Bizning kalibrlangan chorrahamiz | Hammasi, kamera siljigan bo'lsa ham avtomatik moslashadi |

---

## 4. Texnologiya (sodda tilda)

```
Video → [1] Aniqlash + kuzatish → [2] Sahna → [3] Hodisalar → [4] Maxfiylik → [5] Hisobot
```

**[1] Aniqlash va kuzatish**
- **YOLO26m** modeli. Bu **biz o'zimiz o'qitgan** model: Toshkent chorrahasidan 214 ta kadrda **12,990 ta box**ni o'zimiz belgiladik.
- 8 klass: piyoda, velosiped, yengil mashina, mototsikl, avtobus, yuk mashina, **svetofor qizil / qizil emas**.
- **ByteTrack** har bir obyektga doimiy raqam (ID) beradi va harakatini kuzatadi.
- Sekundiga ~10 kadr tahlil qilinadi.

**[2] Sahna: yo'l qayerda, zebra qayerda**
- Zona chizilgan bo'lsa, o'shalar ishlatiladi.
- Bizning chorraha bo'lsa, fon rasmi solishtiriladi (ORB + RANSAC) va kalibrlangan zonalar moslashtiriladi.
- **Zero-config (finalda yangi):** kadr 32 ustunli to'rga bo'linadi. Har bir katakda mashinalar qaysi yo'nalishda yurishi yig'iladi. Natijada tizim **o'zi o'rganadi**: yo'l qayerda va har bir polosada harakat qaysi tomonga.

**[3] Hodisalar: 10 ta tushunarli qoida**
- Masalan, **qizilda o'tish**: mashina oyoq nuqtasi stop-chiziqni kesib o'tgan paytda svetofor qizil.
- **Qarama-qarshi harakat:** mashina o'rganilgan yo'nalishga teskari yurgan. Muhim nuqta: mashinaning **o'z izi chiqarib tashlanib** tekshiriladi (leave-one-out). Shuning uchun bitta teskari yurgan mashina tizimga "noto'g'ri yo'nalish"ni o'rgata olmaydi.
- **Xavfli yaqinlashuv:** ikki obyekt hozirgi tezligida necha soniyada to'qnashishini hisoblaydi (time-to-collision).
- **Nega qoidalar, nega neural tarmoq emas?** Har bir hodisa turi uchun bir necha misol bor, neural tarmoq o'rganishi uchun yetmaydi. Qoidani esa videoga qarab tekshirsa bo'ladi, shuning uchun muhandis unga ishonadi.

**[4] Maxfiylik (finalda yangi)**
- **Raqamlar:** avval bizning model mashinani topadi. Keyin ochiq raqam aniqlovchi model **faqat mashina ichida** raqamni qidiradi (ikki bosqichli). Butun kadrda qidirgandan ko'ra kichik raqamlarni yaxshiroq topadi.
- **Yuzlar:** har bir piyodaning boshi (box'ning yuqori 22%) xiralashtiriladi. Kuzatuvchi ko'rgan har bir odamning boshi xira bo'ladi.
- Hammasi **serverda**, video foydalanuvchiga borishidan oldin bajariladi. Videolar 6 soatdan keyin o'chiriladi.

**[4b] Xavfli to'qnashuvlar: PET (finalda yangi, xalqaro standart)**
- **PET (post-encroachment time):** bitta yo'l harakati ishtirokchisi biror nuqtani tark etgandan keyin ikkinchisi o'sha nuqtaga necha soniyada yetib kelgani.
  - Misol: piyoda yo'lni kesib o'tdi, 0.7 soniyadan keyin uning izidan mashina o'tdi. Bu PET = 0.7 s, ya'ni ular bir-biridan soniyaning bir qismi bilan "qochib qolgan".
- **Darajalar:**
  - **1.5 s dan kam** = jiddiy (haydovchi reaksiya vaqti);
  - 1.5–3 s = o'rtacha;
  - 3–5 s = oddiy o'zaro ta'sir.
- Bu darajalar AQShning **Bellevue** shahri 75 ta chorrahada qilgan tadqiqotdagi bilan bir xil. **Miovision, Transoft/Brisk Synergies, Derq** kabi kompaniyalar aynan shu o'lchovni sotadi.
- **Bizdagi filtrlar:**
  - faqat yo'l (carriageway) qismidagi nuqtalar hisoblanadi, yo'lak hisobga olinmaydi;
  - ikkala ishtirokchi ham harakatda bo'lishi kerak;
  - mototsikl/velosiped haydovchisi "piyoda" deb hisoblanmaydi;
  - bir-birining ortidan ketayotgan mashinalar hisoblanmaydi.
- **Ekspozitsiya:** "1000 ta piyodaga nechta jiddiy holat". Shunda gavjum va tinch chorrahalarni teng solishtirish mumkin.
- **Tekshiruv:**
  - Bizning labellardagi 9 ta "piyodaga yo'l bermaslik" hodisasidan 7 tasida PET < 3 s holat topildi.
  - Bitta videodagi 12 ta jiddiy holatni ko'z bilan tekshirdik: 11 tasi haqiqiy (masalan mototsikl zebrada piyodalar orasidan o'tgan), 1 tasi xato (piyoda mashina orqasida turgan).
  - Ochiq aytamiz: PET uchun tayyor "to'g'ri javob" yo'q.

**[5] Hisobot**
- Har bir hodisa turi: soni, soatiga nechta (video 5 daqiqadan uzun bo'lsa), umumiy vaqti.
- Tavsiyalar qat'iy qoidalar asosida beriladi (LLM emas). Har bir tavsiya o'zini qaysi raqam keltirib chiqarganini ko'rsatadi.

**Qayerda ishlaydi:** o'z GPU serverimizda (RTX 3060). Sayt Hugging Face'da. Kod GitHub'da: har yangilanish **GitHub Actions** orqali avtomatik deploy qilinadi va deploy tarixi yoziladi.

---

## 5. Raqamlar (hammasi o'zimiz qurgan test to'plamlarida o'lchangan)

| Nima | Qanday test | Natija | Izoh |
|---|---|---|---|
| Detektor | O'qitishda ishlatilmagan 22 kadr, 1386 box | **mAP50 = 0.978** | 1 ga qanchalik yaqin bo'lsa, shuncha yaxshi |
| Hodisa qoidalari (zonalar bilan) | 4 video, 18 min, bizning labellar | **Score A = 0.83** | Optimistik: qoidalar shu videolarda sozlangan |
| Qarama-qarshi harakat (zonasiz) | 18 min real trafik | **0 ta yolg'on signal** | |
| Qarama-qarshi harakat (zonasiz) | 60 ta real mashina izi teskari aylantirildi | **93% topildi** | Sun'iy test, ochiq aytamiz |
| To'xtab qolgan mashina / tirbandlik (zonasiz) | bizning labellar | F1 0.0–0.67 | **Zaif.** Qizildagi navbatni tirbandlik deb o'ylaydi |
| Tezlik | RTX 3060 | **Real vaqtdan 2× tez**, rasm 0.5–0.7 s | |
| Sig'im | 5 fps'da aniqlik tushmaydi (0.828 → 0.827) | **1 GPU ≈ 4 kamera** | |

**Ob-havo va yorug'lik testi** (detektor, mAP50; sun'iy buzilishlar, chunki hamma datamiz kunduzgi):

| Sharoit | Kunduzgi model | Tungi model (finalda o'qitilgan) |
|---|---|---|
| Kunduz | **0.975** ✓ | 0.978 |
| Tuman | **0.971** ✓ | 0.976 |
| Past sifatli video | **0.881** ✓ | 0.857 |
| Yomg'ir | **0.793** ✓ | 0.967 |
| Harakatdagi xiralik | **0.712** ✓ | 0.959 |
| **Tun** | 0.390 | **0.916** ✓ |

(✓ = tizim shu sharoitda qaysi modelni ishlatadi)

- **Tun avval zaif tomonimiz edi (0.39).** Kadrni yorqinlashtirishni sinadik, natija **yomonlashdi** (0.39 → 0.27). Bu "nima ishlamadi" misoli.
- **Finalda** o'quv kadrlarining sun'iy tungi, yomg'irli va xira nusxalari bilan modelni qayta o'qitdik: tun **0.39 → 0.92**.
- Lekin yangi model kunduzgi videoda hodisa bahosini **0.83 dan 0.77 ga** tushirdi, chunki qoidalar eski model uchun sozlangan.
- **Yechim: har bir kamera uchun modelni avtomatik tanlash.** Video yuklanganda tizim 6 ta kadrda uchta modelni sinaydi:
  1. bizning kunduzgi modelimiz (Toshkent);
  2. bizning tungi modelimiz;
  3. umumiy COCO modeli (millionlab rasmlarda o'qitilgan).

  Qaysi biri aniq ko'proq ishonchli obyekt topsa, o'sha tanlanadi. Teng bo'lsa, kunduzgi modelimiz qoladi, chunki qoidalar u uchun sozlangan.
- **Nega yorug'lik bo'yicha emas:** ko'cha chiroqlari ostidagi haqiqiy tun yorug'lik bo'yicha kunduzgi Nyu-York kadri bilan bir xil chiqdi (~90). Shuning uchun bu usuldan voz kechdik. Bu ham "nima ishlamadi" misoli.
- **Boshqa shaharlardagi 7 ta ochiq video bilan sinov:**
  - tungi dron ko'rinishida bizning model 3 ta, COCO 137 ta obyekt topdi, shuning uchun COCO tanlandi;
  - Shibuya (Tokio) va bizning chorrahada esa o'z modelimiz yaxshiroq.
- **Ochiq aytamiz:** tungi model qanday sun'iy tunda o'qitilgan bo'lsa, xuddi shunday sun'iy tunda sinaldi. Haqiqiy tungi kamerada natija boshqacha bo'lishi mumkin. Haqiqiy tungi video pilotning 1-oyida yig'iladi.

---

## 5b. Xalqaro tajriba va raqobatchilar (hakamlar so'rasa)

**Kim nima qilyapti:**
- **Bellevue (AQSh):** 75 ta chorrahani mavjud kameralar orqali PET bilan tekshirgan.
  - Bitta chorrahada chapga burilish uchun alohida svetofor qo'shilgach, xavfli holatlar 2.1% dan 0.1% ga tushgan.
  - Zebra yorqinroq bo'yalgach, piyoda bilan bog'liq xavfli holatlar 56% kamaygan.
  - Bu bizning "oldin/keyin" funksiyamizning aynan o'zi.
- **Nyu-York (NYC DOT):** 12 ta joyda Viva sensorlarini sinagan.
- **Derq:** Las-Vegasda 20 tagacha va Fremontda 37 ta chorraha.
- **Toronto:** Vision Zero dasturida Transoft bilan ishlagan.
- **Miovision:** 2025 yilda mavjud kameralarda doimiy monitoringni boshlagan. Bozor bir martalik tadqiqotdan obunaga o'tyapti.
- **Narxlar** (taxminiy, manbalar README va tadqiqotda):
  - Miovision: bitta chorrahani tekshirish (48–60 soat video) ~**8,000 $**, qurilma ~6,800 $;
  - Vivacity (Angliya): sensor boshiga yiliga ~650 £.
  - Biz: kamera boshiga oyiga 40 $ = **yiliga 480 $**, mavjud kamerada, doimiy.
- **Sug'urtachilar ham to'laydi:**
  - Kanadada Aviva sug'urta kompaniyasi bunday tadqiqotlarni moliyalashtirgan.
  - Avstraliyaning Queensland shtatida majburiy sug'urta komissiyasi moliyalashtirgan.
- **Shaharlar qanday saralaydi:** AQSh Highway Safety Manual'dagi **Empirical Bayes** usulida. Bizning dashboard'da ham bor ("Rank by: Excess expected conflicts").
  - Bu usul qisqa yoki tinch videoni tasodifan birinchi o'ringa chiqarmaydi.
  - k = 0.5 koeffitsienti hozircha **faraz**, pilotda o'lchanadi.

**Bizning farqimiz (gapirish uchun):**
1. "Miovision bitta chorrahani bir marta tekshirish uchun ~8 ming dollar oladi. Biz shahar kamerasida 24/7 ishlaymiz va bir yil uchun bitta tekshiruvdan arzonmiz."
2. "Biz sohaning standart usullarini ishlatamiz: PET < 1.5 s, 1000 piyodaga nisbat, HSM Empirical Bayes."
3. "AQSh kompaniyalarini sotib ololmaydigan shaharlar uchun: shahar serverida ishlaydi, yuz va raqamlar xiralashtiriladi, mahalliy mashinalarda o'qitilgan."
4. "O'zbekistonda majburiy avtosug'urta kompaniyalari tabiiy hamkor (Kanada va Avstraliya tajribasi)."

---

## 6. Biznes (barcha raqamlar faraz, saytdagi kalkulyatorda o'zgartirsa bo'ladi)

**3 oylik pilot: 8 kamera, 3 chorraha, $12,400**
- Jamoa 3 kishi × 3 oy × $900 = $8,100
- 2 ta GPU server × $1,200 = $2,400
- Labellash = $1,500
- Elektr, hosting = $400
- Litsenziya: Ultralytics AGPL-3.0, ochiq kod = $0

**Kamera boshiga oylik:**
- Narx (faraz): $40
- Server: $1,200 / 36 oy / 4 kamera = $8.3
- Elektr: 0.3 kW × 720 soat × $0.08 / 4 = $4.3
- **Marja: $27.3 (68%)**

**Natija:**
- 110 kamerada o'zini qoplaydi;
- 300 kamerada oyiga $5,200 foyda;
- pilot xarajati 2.4 oyda qaytadi.

**Mijoz uchun foyda (ROI)** pilotda o'lchanadi: bitta o'zgarishdan oldin va keyin soatiga nechta qoidabuzarlik bo'lgani.

**Pilot rejasi (3 oy):**
1. **1-oy:** shahar serveriga 8 kamera ulash, tungi va yomg'irli video yig'ish.
2. **2-oy:** labellash va qayta o'qitish.
3. **3-oy:** bitta o'zgarishni (masalan piyodaga oldinroq yashil) oldin va keyin o'lchash.

**Qonun va maxfiylik:** video shahar serveridan chiqmaydi, yuz va raqamlar xiralashtiriladi, faqat hodisa ma'lumoti saqlanadi.

---

## 7. Finalgacha nima bor edi, finalda nima qilindi (MUHIM, hakamlar so'raydi)

Qoidada aytilgan: finalgacha qilingan ishni finalda qilingan deb ko'rsatish **taqiqlangan**, lekin uni e'lon qilib ishlatish **mumkin**. Biz uni README'da va git tarixida ochiq ajratganmiz: birinchi commit "Import elimination-stage code".

| Finalgacha (elimination) | Finalda (10–11 oktabr) |
|---|---|
| Detektor: o'qitilgan YOLO26m, 12,990 box | **Zero-config:** yo'l va yo'nalishlarni transportdan o'rganish |
| Kuzatish (ByteTrack), kamera siljishini tuzatish | **Istalgan kamera** uchun qoidalar: qarama-qarshi harakat va boshqalar |
| Bitta chorraha uchun zona qoidalari | **Brauzerda zona chizish**, yo'l chizilmasa o'zi topadi |
| Avariya xavfi (TTC) | **Maxfiylik:** raqam va yuzlarni xiralashtirish |
| Elimination sayti | **Yangi API va sayt:** video/rasm, zonalar, hisobot |
| | **Shahar hisoboti** va tavsiyalar |
| | **Tun/yomg'ir testi**, tungi model, har bir kamera uchun model tanlash (bizniki / tungi / COCO) |
| | Boshqa shaharlardan **7 ta ochiq litsenziyali video** bilan sinov (Nyu-York, Tokio, Ottava, dron, tun, yomg'ir) |
| | **PET** (xalqaro standart) va **Empirical Bayes** reytingi |
| | **Biznes modeli**, kalkulyator |
| | **City dashboard:** kameralar reytingi, xavf xaritasi, oldin/keyin taqqoslash |
| | **PDF hisobot** muhandis uchun |
| | Saytdagi barcha namuna video va rasmlar **yuz/raqam xiralashtirilgan** holda qayta chiqarildi |
| | **CI/CD:** GitHub Actions orqali o'z GPU serverimizga deploy |

---

## 8. Demo qanday ko'rsatiladi (2 daqiqa)

**Oldindan tayyorlang:**
- saytni noutbukda ochib qo'ying;
- 40 soniyalik video tayyor tursin;
- zaxira video: `docs/demo_backup.mp4`.

1. QR kodni ko'rsating: "telefoningizda ochib ko'ring".
2. **Analyse your video** → videoni yuklang. Progress chiqadi.
3. Ishlanayotganda zebra va stop-chiziqni chizing (10 soniya). "Bu yangi kamera uchun 2 daqiqalik sozlash."
4. Natijada:
   - **Safety report**: hodisalar va tavsiya;
   - **Learned lane directions**: "tizim yo'nalishlarni o'zi o'rgandi";
   - videoda xira yuz va raqamlarni ko'rsating.
5. Hakam o'z videosini bersa, darhol yuklang: tizim istalgan kamerada ishlaydi.
6. **PDF report** tugmasini bosing: muhandis hisoboti chiqadi.
7. **City dashboard** bo'limiga o'ting: yuklangan video reytingda paydo bo'lgan. Xavf xaritasi va "Before / after" taqqoslashni ko'rsating.
8. Vaqt qolsa, **Validation** bo'limida "Best example of → Red-light running" misolini oching.

**Internet yoki server ishlamasa:** zaxira videoni qo'ying va "bu yozib olingan haqiqiy ishlash" deb ayting. Qoidaga ko'ra texnik muammo vaqtni to'xtatmaydi.

---

## 9. Hakamlar savollari va javoblar

- **"Bu shunchaki ChatGPT/LLM chaqiruvimi?"**
  — Yo'q. Hech qanday LLM chaqirilmaydi. O'zimiz o'qitgan detektor, kuzatuvchi va o'zimiz yozib, o'lchagan 10 ta qoida.
- **"Kod LLM bilan yozilganmi?"**
  — Ha, AI yordamchi bilan yozdik, README'da ko'rsatilgan. Arxitektura, data va qarorlar bizniki. Har bir qismni tushuntira olamiz.
  — Ko'rsatish uchun fayllar: `core/doppix/generic.py` (zonasiz qoidalar), `autoscene.py` (yo'nalishlarni o'rganish), `privacy.py` (xiralashtirish).
- **"Boshqa jamoa buni bir kunda qila oladimi?"**
  — Yo'q:
  1. 12,990 ta qo'lda belgilangan box va Toshkent mashinalari;
  2. o'z labellash dasturimiz;
  3. o'zimiz labellagan test to'plamida o'lchangan qoidalar;
  4. o'z izini chiqarib tashlab yo'nalishni o'rganish usuli.
- **"Tunda ishlaydimi?"**
  — Sun'iy tungi testda 0.39 edi. Finalda qayta o'qitib, 0.92 ga chiqardik. Qorong'i videoda tizim shu modelni o'zi tanlaydi. Lekin bu sun'iy test, haqiqiy tungi video bilan tekshirish pilotning 1-oyida.
- **"Boshqa kamerada ishlaydimi?"**
  — Ha. Dashboard'da boshqa shaharlardan 7 ta ochiq litsenziyali video bor: Nyu-York, Tokio (Shibuya), Ottava (qor), Times Square (yomg'irli tun), ikkita dron ko'rinishi.
  — Ochiq aytamiz:
    - qisqa (20–80 s) videoda zona chizilmasa, kam hodisa topiladi;
    - kunduzgi dron ko'rinishida hali ikkala model ham zaif.

    Yechim: 2 daqiqada zona chizish va pilotda shu kameralar kadrlarida qayta o'qitish.
  — PET Shibuya'da 9 ta, Times Square'da 19 ta jiddiy holatni topdi.
- **"Shaxsiy ma'lumotlar-chi?"**
  — Yuz va raqamlar serverda xiralashtiriladi, videolar 6 soatda o'chadi, faqat hodisa ma'lumoti saqlanadi.
- **"Narx qayerdan?"**
  — Tezlik o'lchangan (1 GPU = 4 kamera). Qolganlari faraz, saytdagi kalkulyatorda hammasini o'zgartirib ko'rish mumkin.
- **"Deploy tarixini ko'rsating."**
  — GitHub → Actions bo'limi. Har bir push = bitta deploy. Server: `deploy/serve.py`.
- **"PET nima, nega u?"**
  — Avariya bo'lishini kutmasdan xavfni o'lchaydigan xalqaro o'lchov. Bellevue, Miovision, Transoft ishlatadi. 1.5 soniyadan kam = jiddiy.
- **"Raqobatchilardan farqingiz?"**
  — 5b-bo'limdagi 4 ta gapni ishlating.
- **"Kim to'laydi?"**
  — Shahar yo'l xavfsizligi budjeti, kamera boshiga obuna. Sug'urtachilar chorrahalar bo'yicha xavf statistikasini sotib oladi.
- **"3 oyda pilot qilsa bo'ladimi?"**
  — Ha. Mavjud kameralar, shahar ichidagi server, yangi qurilma kerak emas.

---

## 10. Havolalar

- **Sayt:** https://giyos1212-safejunction.static.hf.space
- **Kod:** https://github.com/ubaydullayevgiyosiddin7-eng/doppix-safejunction
- **Taqdimot:** `docs/DoppiX_SafeJunction_deck.pdf`
- **Nutq:** `docs/NUTQ_7daqiqa.md`
- **Zaxira demo:** `docs/demo_backup.mp4`
