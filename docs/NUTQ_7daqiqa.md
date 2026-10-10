# Do'ppiX SafeJunction — 7 daqiqalik nutq

Rejim: **Startup**. Tavsiya etilgan taqsimot: muammo 1 min, demo 2 min, texnologiya 2 min, budjet 1.5 min, keyingi qadamlar 0.5 min.
Kim gapiradi (o'zgartirsangiz bo'ladi): **Eldor**: 1, 2, 5, 6, 7 · **Shohruh**: 3, 4 (jonli demo) · **Ibodulla**: 8, 9, 10.

> Jonli demo uchun oldindan: saytni telefon/noutbukda ochib qo'ying. 40 soniyalik video tayyor tursin. Internet uzilsa, zaxira video bor (`docs/demo_backup.mp4`).

---

### 1-slayd · 0:00–0:20 · Eldor
"Biz Do'ppiX jamoasimiz. Rejimimiz: **Startup**. SafeJunction shahardagi istalgan yo'l kamerasini yo'l xavfsizligi auditoriga aylantiradi."

### 2-slayd · 0:20–1:05 · Eldor
"Bugun shahar qaysi chorraha xavfli ekanini **avariyadan keyin** biladi. Biz bitta Toshkent chorrahasining 18 daqiqalik videosini o'zimiz labelladik:
- piyodalar zebradan tashqarida soatiga 52 marta yuradi;
- mashinalar soatiga 29 marta piyodaga yo'l bermaydi;
- qizilda o'tish soatiga 7 marta.

Hech kim jarohatlanmagan, shuning uchun bularning birortasi statistikaga tushmaydi. Foydalanuvchimiz: tuman yo'l harakati muhandisi. Pul to'lovchi: shahar yo'l xavfsizligi budjeti, kamera boshiga oylik obuna."

### 3-slayd · 1:05–1:35 · Shohruh
"Yangi kamera 2 daqiqada ulanadi. Videoni yuklaysiz, xohlasangiz zebra va stop-chiziqni chizasiz, natijada hisobot olasiz. Zona chizilmasa ham ishlaydi: yo'l va harakat yo'nalishini transportning o'zidan o'rganadi."

### 4-slayd · 1:35–3:05 · Shohruh · JONLI DEMO
1. QR kodni ko'rsating: "Telefoningizda sinab ko'ring."
2. Saytda **Choose file** → 40 soniyalik video. Progress chiqadi.
3. Ishlanayotganda zebra va stop-chiziqni chizing (10 soniya).
4. Natija:
   - **Safety report**: hodisalar soni;
   - **Learned lane directions** tugmasi: ko'k strelkalar, "tizim buni o'zi o'rgandi";
   - videoda yuzlar va raqamlar xiralashtirilgan.
5. Hakam video bersa, shu yerda uni yuklang.

Vaqt yetmasa: **Results** bo'limida tayyor misol ("Best example of → Red-light running").

### 5-slayd · 3:05–4:05 · Eldor
"Bu birovning modeliga bitta so'rov emas, to'liq tizim:
- o'zimiz o'qitgan YOLO26m va kuzatuv (tracking);
- sahna: chizilgan zonalar, tanilgan kamera yoki transportdan o'rganilgan yo'nalishlar;
- 10 ta tushunarli qoida;
- yuz va raqamlarni xiralashtirish;
- hisobot.

Hammasi shahar serverida, bitta RTX 3060'da ishlaydi va real vaqtdan 2 barobar tez. Bitta GPU 4 ta kamerani ko'taradi. Kamera boshiga infratuzilma narxi oyiga ~13 dollar."

### 6-slayd · 4:05–4:45 · Eldor
"Nima uchun buni bir dam olish kunida nusxalab bo'lmaydi?
1. **Data:** o'zimiz labellagan 12,990 ta box: Toshkent mashinalari, bizning svetoforlar. Buning uchun o'z labellash dasturimizni yozdik.
2. **Pipeline:** yo'nalishlarni transportdan o'rganish. Mashina o'z izi chiqarib tashlangan holda tekshiriladi, shuning uchun bitta teskari yurgan mashina tizimni adashtira olmaydi.
3. Har bir qoida o'zimiz labellagan test to'plamida o'lchangan."

### 7-slayd · 4:45–5:25 · Eldor
"Raqamlar halol:
- teskari harakat: 18 daqiqa real trafikda **0 ta yolg'on signal**, sun'iy teskari yurgizilgan 60 mashinaning **93%** i topildi;
- zaif tomonimiz **tun**: aniqlik 0.39. Kadrni yorqinlashtirish yordam bermadi, yomonlashtirdi. Yechim: tungi data bilan o'qitish, bu pilotning birinchi oyi."
*(Agar qayta o'qitish natijasi kelgan bo'lsa: "tun uchun qayta o'qitib, 0.39 dan X ga ko'tardik".)*

### 8-slayd · 5:25–6:20 · Ibodulla
"3 oylik pilot 12,400 dollar turadi: 8 kamera, 3 chorraha. Bunga 3 kishilik jamoa, 2 ta server va labellash kiradi. Obuna kamera boshiga oyiga 40 dollar, infratuzilma 12.7 dollar, ya'ni marja 68%. 110 kamerada o'zini qoplaydi. 300 kamerada pilot 2.4 oyda qaytadi. Barcha farazlar saytdagi kalkulyatorda, o'zingiz o'zgartirib ko'rishingiz mumkin."

### 9-slayd · 6:20–6:50 · Ibodulla
"Pilot uch oyda, mavjud qoidalar doirasida:
- 1-oy: kameralarni ulash va tungi video yig'ish;
- 2-oy: qayta o'qitish;
- 3-oy: bitta o'zgarishni, masalan piyodaga oldinroq yashil berishni, oldin va keyin o'lchash.

Video shahar serveridan chiqmaydi, yuz va raqamlar xiralashtiriladi, faqat hodisa metadatasi saqlanadi."

### 10-slayd · 6:50–7:00 · Ibodulla
"Final oldidan qilingan ish (elimination) va finalda qilingan ish README'da va git tarixida alohida ko'rsatilgan. Rahmat!"

---

## Kutilayotgan savollar va qisqa javoblar
- **"LLM bilan yozilganmi?"** — "Ha, AI assistent bilan yozdik, bu README'da yozilgan. Lekin arxitektura, data va qoidalar bizniki. Har bir qismni tushuntira olamiz." *(Kodni oching: `core/doppix/generic.py`, `autoscene.py`.)*
- **"Tunda ishlaydimi?"** — "Hozir zaif (0.39), raqam bilan ko'rsatdik. Yechim: tungi data. Yorqinlashtirishni sinadik, ishlamadi."
- **"Boshqa kamerada ishlaydimi?"** — "Ha, zero-config rejimida ishlaydi. Begona kamerani ko'zgu aylantirib va kesib sinadik: tizim uni tanimadi va yo'nalishlarni o'zi o'rgandi."
- **"Deploy tarixi?"** — GitHub → Actions bo'limi (har bir push = deploy). Server: `deploy/serve.py`.
- **"Shaxsiy ma'lumotlar?"** — Yuzlar va raqamlar serverda xiralashtiriladi, videolar 6 soatdan keyin o'chiriladi, faqat metadata saqlanadi.
- **"Nega qoidalar, nega neural tarmoq emas?"** — "Har bir hodisa turi uchun bir necha misol bor, neural tarmoq o'rganishi uchun yetmaydi. Qoidani esa videoga qarab tekshirsa bo'ladi, muhandis unga ishonadi."
