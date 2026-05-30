# Dokumentasi Proyek Portal Pemesanan Travel Premium - AgentTravel

Dokumen ini berisi informasi teknis, arsitektur, fitur utama, serta panduan instalasi untuk menjalankan aplikasi AgentTravel. Proyek ini dikembangkan menggunakan Spring Boot sebagai backend RESTful API dan arsitektur Single Page Application (SPA) berbasis HTML5, CSS3, dan Javascript Vanilla pada sisi frontend.

---

## Deskripsi Proyek

AgentTravel adalah platform portal pemesanan travel premium yang mengintegrasikan berbagai modul pencarian produk pariwisata (Tiket Penerbangan, Reservasi Kamar Hotel, dan Paket Wisata Lengkap) dengan sistem otorisasi multi-peran dan sistem pembayaran gateway real-time. Platform ini dirancang untuk mensimulasikan alur kerja portal travel skala komersial secara komprehensif.

---

## Fitur Utama Sistem

### 1. Otorisasi Multi-Peran (Multi-Role Authorization)
Sistem pembatasan hak akses diatur secara ketat menggunakan Spring Security di backend dan render antarmuka dinamis di frontend:
*   **ADMIN**: Peran manajemen tingkat tertinggi yang memiliki wewenang penuh untuk menambahkan destinasi wisata baru, melihat daftar seluruh transaksi pemesanan semua pelanggan di sistem, serta mengonfirmasi atau membatalkan pesanan.
*   **OPERATOR**: Peran staf operasional yang berwenang mengelola status pesanan (mengonfirmasi dan membatalkan transaksi) serta memantau daftar transaksi pelanggan, namun tidak diizinkan menambahkan atau mengedit aset destinasi wisata.
*   **USER**: Peran pelanggan biasa yang hanya dapat melakukan pemesanan (pesawat, hotel, paket wisata), membatalkan pesanan milik sendiri yang masih berstatus PENDING, dan memantau riwayat perjalanan pribadi mereka.

### 2. Modul Pencarian dan Pemesanan Produk Travel
*   **Tiket Penerbangan (Flights)**: Modul pencarian rute penerbangan populer (Jakarta, Surabaya, Bali, Tokyo, Singapura, Seoul) dengan selektor kelas kursi. Pengguna dapat memilih maskapai penerbangan premium (Garuda Indonesia, Singapore Airlines, Japan Airlines, Batik Air) yang harganya berfluktuasi secara dinamis.
*   **Reservasi Kamar Hotel (Hotels)**: Modul pencarian kamar hotel mewah yang dilengkapi detail ulasan bintang, fasilitas ryokan/resort, deskripsi kamar, serta tarif per malam.
*   **Paket Wisata (Holiday Packages)**: Penjelajah paket perjalanan komplit yang didukung filter pencarian *keyword* debounced untuk efisiensi kueri database.
*   **Integrasi Basis Data**: Seluruh pemesanan produk penerbangan dan hotel di frontend secara otomatis dikonversi menjadi data pemesanan di basis data backend Spring Boot asli melalui relasi JPA.

### 3. Dasbor Riwayat Pemesanan (Booking History Center)
Dasbor khusus pelanggan yang menyajikan data perjalanan secara visual dengan filter tab status:
*   **Active Trips**: Menyimpan transaksi tiket perjalanan mendatang atau pesanan pembayaran berstatus PENDING.
*   **Past & Completed**: Menyimpan riwayat perjalanan yang telah berhasil diselesaikan secara historis.
*   **Cancelled**: Menyimpan transaksi yang telah dibatalkan atau dikembalikan dana (*refunded*).

### 4. Integrasi Payment Gateway Midtrans (Snap & Simulator)
*   **Midtrans Snap Integration**: Menggunakan modal popup mengambang (*floating modal*) di sisi klien untuk memproses pembayaran nyata (Virtual Account, QRIS, Kartu Kredit) di lingkungan Sandbox Midtrans.
*   **Verifikasi Webhook SHA-512**: Backend memproses callback notifikasi pembayaran HTTP POST dari Midtrans secara aman dengan memverifikasi tanda tangan elektronik (*signature key*) berbasis hashing SHA-512.
*   **Interactive Mock Payment Gateway**: Apabila kunci API Midtrans tidak dikonfigurasi, sistem secara otomatis beralih ke Mode Simulasi Interaktif. Dasbor menyajikan simulasi pembayaran QRIS, Virtual Account, dan Kartu Kredit secara visual dengan loading spinner yang menembak callback webhook simulasi secara real-time.

### 5. Dokumen Tiket Elektronik (Printable E-Ticket)
*   Setiap pemesanan yang telah lunas (berstatus CONFIRMED) akan menerbitkan E-Ticket.
*   E-Ticket menampilkan barcode transaksi, kode pemesanan unik (`AT-20260530-[ID]`), QR code boarding, rincian daftar penumpang, serta syarat dan ketentuan check-in.
*   Tombol cetak e-ticket terintegrasi dengan media stylesheet cetak khusus browser (`@media print`), memastikan proses pencetakan hanya mengisolasi lembaran tiket berlatar putih formal tanpa mencetak elemen dasbor web.

---

## Teknologi dan Arsitektur

### Backend
*   **Bahasa Pemrograman & Runtime**: Java 21
*   **Framework Utama**: Spring Boot 4.0.6
*   **Keamanan**: Spring Security 6+ & JSON Web Token (JWT)
*   **Database ORM**: Spring Data JPA & Hibernate
*   **Database Engine**: H2 In-Memory Database (skenario pengembangan cepat)
*   **Dokumentasi API**: Springdoc OpenAPI / Swagger UI

### Frontend
*   **Markup & Struktur**: HTML5 (Struktur semantik)
*   **Gaya & Desain**: Vanilla CSS3 (Mengadopsi variabel kustom, glassmorphism, visual bertema gelap premium, dan tipografi Outfit dari Google Fonts)
*   **Logika Klien**: Javascript ES6 (Single Page Application, pengelolaan state stateless berbasis localStorage JWT)

---

## Panduan Instalasi dan Cara Menjalankan

### Prasyarat Sistem
*   Java Development Kit (JDK) versi 21 atau lebih tinggi
*   Apache Maven versi 3.9 atau lebih tinggi (dapat digantikan oleh Maven Wrapper `./mvnw`)

### Langkah-Langkah Menjalankan Proyek

1.  **Clone Repositori**:
    ```bash
    git clone https://github.com/isnaaziz/agent-travel.git
    cd agent-travel
    ```

2.  **Kompilasi Proyek**:
    Gunakan Maven Wrapper untuk membersihkan dan mengompilasi kode sumber Java:
    ```bash
    ./mvnw clean compile
    ```

3.  **Jalankan Aplikasi**:
    Jalankan server pengembangan Spring Boot lokal:
    ```bash
    ./mvnw spring-boot:run
    ```

4.  **Akses Aplikasi**:
    *   **Portal Antarmuka Klien (Web SPA)**: Buka browser dan akses halaman utama di [http://localhost:8080/](http://localhost:8080/)
    *   **Dokumentasi API Terintegrasi (Swagger UI)**: Akses konsol dokumentasi API di [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html)
    *   **Konsol Database H2**: Akses antarmuka database in-memory di [http://localhost:8080/h2-console](http://localhost:8080/h2-console) (URL JDBC: `jdbc:h2:mem:agenttraveldb`, Username: `sa`, Password: `password`)

---

## Konfigurasi Kunci API Midtrans

Konfigurasi parameter gateway pembayaran Midtrans didefinisikan pada berkas `/src/main/resources/application.yml`. Anda dapat memperbarui parameter tersebut secara langsung atau melalui variabel lingkungan (*environment variables*):

```yaml
midtrans:
  server-key: ${MIDTRANS_SERVER_KEY:YOUR_SERVER_KEY}
  client-key: ${MIDTRANS_CLIENT_KEY:YOUR_CLIENT_KEY}
  is-production: false
```

*Catatan: Apabila `server-key` dibiarkan bernilai `"YOUR_SERVER_KEY"`, sistem secara otomatis mengaktifkan Simulator Pembayaran Interaktif pada antarmuka frontend.*

---

## Struktur Direktori Proyek

Aplikasi dikembangkan menggunakan pendekatan "Package-by-Feature" untuk mempermudah pemeliharaan jangka panjang dan kerapian arsitektur kode sumber:

```
com/agent/travel/
├── config/                      # Konfigurasi Spring Security, filter JWT, dan penginisiasi data
├── controller/                  # REST API Controllers (Autentikasi, Pemesanan, Destinasi, Pembayaran)
├── dto/                         # Data Transfer Objects untuk permintaan payload API
├── exception/                   # Manajemen penanganan eror global dan exception kustom
├── model/                       # Kelas Entitas JPA Hibernate (User, Booking, Destination)
├── repository/                  # JPA Repositories untuk kueri database relasional
└── service/                     # Kelas Logika Bisnis (Proses JWT, Autentikasi Google, Pemesanan, Pembayaran)
```
