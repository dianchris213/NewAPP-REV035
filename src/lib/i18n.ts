import type { Language } from "./app-store";

export type Dict = {
  settingsEyebrow: string;
  settingsTitle: string;
  notSignedIn: string;
  profileNotLinked: string;
  signedInVia: string;
  groupPreferences: string;
  groupSecurity: string;
  groupData: string;
  language: string;
  languageHint: string;
  theme: string;
  themeOn: string;
  themeOff: string;
  notifications: string;
  notificationsOn: string;
  notificationsOff: string;
  appLock: string;
  appLockOn: string;
  appLockOff: string;
  appLockNote: string;
  cloudSync: string;
  cloudSyncOn: string;
  cloudSyncOff: string;
  categories: string;
  categoriesHint: string;
  exportData: string;
  exportHint: string;
  logout: string;
  deleteAccount: string;
  manage: string;
  categoriesEmpty: string;
  addCategory: string;
  categoryName: string;
  categoryScope: string;
  allAccounts: string;
  income: string;
  expense: string;
  save: string;
  cancel: string;
  close: string;
  delete: string;
  invalidCategory: string;
  lockedTitle: string;
  lockedBody: string;
  unlock: string;
  accountHistory: string;
  accountHistoryEmpty: string;
  rename: string;
  renameCategory: string;
  categoryInUse: string;
  searchPlaceholder: string;
  dateFrom: string;
  dateTo: string;
  resetFilters: string;
  noResults: string;
  categoryDeleted: string;
  categoryRenamed: string;
  searchCategories: string;
  sortLabel: string;
  sortNameAsc: string;
  sortNameDesc: string;
  sortMostUsed: string;
  noCategoryResults: string;
  showAllCategories: string;
  collapseCategories: string;
  fundSources: string;
  fundSourcesEmpty: string;
  addFundSource: string;
  fundSourceName: string;
  fundSourceType: string;
  fundSourceBalance: string;
  invalidFundSource: string;
  fundSourceHint: string;
  saving: string;
  fundSourceInUse: string;
  fundSourceAdded: string;
  fundSourceRenamed: string;
  fundSourceDeleted: string;
  renameFundSource: string;
  searchFundSources: string;
  allTypes: string;
  noFundSourceResults: string;
  confirmDeleteFundSourceTitle: string;
  confirmDeleteFundSourceBody: string;
  confirmDelete: string;
  undo: string;
  fundSourceRestored: string;
  fundSourceRestoreFailed: string;
  fundSourceSaveFailed: string;
  fundSourceSaveFailedHint: string;
  loadingFundSources: string;
  fundSourceLoadFailed: string;
  fundSourceLoadFailedHint: string;
  retryLoadFundSources: string;
  fundSourceReloaded: string;
  fundSourceListLabel: string;
  fundSourceRowLabel: string;
  undoIn: string;
  undoHint: string;
  resetFilter: string;
  filtersResetAll: string;
  emptyFundSourceTitle: string;
  emptyFundSourceBody: string;
  emptyTypeHint: string;
};

const dictionaries: Record<Language, Dict> = {
  id: {
    settingsEyebrow: "Konfigurasi",
    settingsTitle: "Pengaturan",
    notSignedIn: "Belum masuk",
    profileNotLinked: "Profil belum tersambung",
    signedInVia: "Masuk via",
    groupPreferences: "Preferensi Aplikasi",
    groupSecurity: "Keamanan",
    groupData: "Data",
    language: "Bahasa Aplikasi",
    languageHint: "Bahasa Indonesia · IDR",
    theme: "Tema Tampilan",
    themeOn: "Mode gelap aktif",
    themeOff: "Mode terang aktif",
    notifications: "Notifikasi Push",
    notificationsOn: "Pengingat transaksi aktif",
    notificationsOff: "Nonaktif",
    appLock: "Kunci Aplikasi / Biometrik",
    appLockOn: "Aktif — minta verifikasi saat dibuka",
    appLockOff: "Nonaktif",
    appLockNote: "Pratinjau: verifikasi perangkat menyusul.",
    cloudSync: "Sinkronisasi Cloud",
    cloudSyncOn: "Tersinkronisasi",
    cloudSyncOff: "Belum tersinkronisasi",
    categories: "Kategori Transaksi",
    categoriesHint: "Kelola kategori",
    exportData: "Ekspor Data Keuangan",
    exportHint: "Unduh laporan",
    logout: "Keluar Akun",
    deleteAccount: "Hapus Akun & Data",
    manage: "Kelola",
    categoriesEmpty: "Belum ada kategori. Tambahkan kategori Anda sendiri.",
    addCategory: "Tambah Kategori",
    categoryName: "Nama Kategori",
    categoryScope: "Berlaku Untuk",
    allAccounts: "Semua akun",
    income: "Pemasukan",
    expense: "Pengeluaran",
    save: "Simpan",
    cancel: "Batal",
    close: "Tutup",
    delete: "Hapus",
    invalidCategory: "Nama kategori 2-24 karakter dan tidak boleh duplikat.",
    lockedTitle: "Dompet Terkunci",
    lockedBody: "Verifikasi identitas Anda untuk membuka halaman Dompet.",
    unlock: "Buka dengan Biometrik",
    accountHistory: "Riwayat Akun",
    accountHistoryEmpty: "Belum ada transaksi pada akun ini.",
    rename: "Ubah nama",
    renameCategory: "Ubah Nama Kategori",
    categoryInUse: "Kategori masih dipakai transaksi dan tidak bisa dihapus.",
    searchPlaceholder: "Cari kategori atau catatan",
    dateFrom: "Dari tanggal",
    dateTo: "Sampai tanggal",
    resetFilters: "Atur ulang filter",
    noResults: "Tidak ada transaksi yang cocok.",
    categoryDeleted: "Kategori dihapus",
    categoryRenamed: "Nama kategori diperbarui",
    searchCategories: "Cari kategori",
    sortLabel: "Urutkan",
    sortNameAsc: "Nama (A-Z)",
    sortNameDesc: "Nama (Z-A)",
    sortMostUsed: "Paling sering dipakai",
    noCategoryResults: "Tidak ada kategori yang cocok.",
    showAllCategories: "Tampilkan semua",
    collapseCategories: "Sembunyikan",
    fundSources: "Sumber Dana",
    fundSourcesEmpty: "Belum ada sumber dana. Tambahkan milik Anda sendiri.",
    addFundSource: "Tambah Sumber Dana",
    fundSourceName: "Nama Sumber Dana",
    fundSourceType: "Jenis",
    fundSourceBalance: "Saldo Awal",
    invalidFundSource: "Nama sumber dana 3-24 karakter dan tidak boleh duplikat.",
    fundSourceHint: "Nama 3-24 karakter, unik antar sumber dana.",
    saving: "Menyimpan…",
    fundSourceInUse: "Sumber dana masih dipakai dan tidak bisa dihapus.",
    fundSourceAdded: "Sumber dana ditambahkan",
    fundSourceRenamed: "Nama sumber dana diperbarui",
    fundSourceDeleted: "Sumber dana dihapus",
    renameFundSource: "Ubah Nama Sumber Dana",
    searchFundSources: "Cari sumber dana",
    allTypes: "Semua Jenis",
    noFundSourceResults: "Tidak ada sumber dana yang cocok.",
    confirmDeleteFundSourceTitle: "Hapus sumber dana?",
    confirmDeleteFundSourceBody:
      "Sumber dana ini belum dipakai. Tindakan ini bisa dibatalkan lewat Undo.",
    confirmDelete: "Ya, hapus",
    undo: "Urungkan",
    fundSourceRestored: "Sumber dana dipulihkan",
    fundSourceRestoreFailed: "Gagal memulihkan sumber dana.",
    fundSourceSaveFailed: "Gagal menyimpan sumber dana. Coba lagi.",
    fundSourceSaveFailedHint: "Data yang Anda isi tetap tersimpan di formulir.",
    loadingFundSources: "Memuat sumber dana…",
    fundSourceLoadFailed: "Gagal memuat daftar sumber dana.",
    fundSourceLoadFailedHint:
      "Data Anda tidak hilang. Periksa koneksi lalu coba muat ulang daftar.",
    retryLoadFundSources: "Muat ulang daftar",
    fundSourceReloaded: "Daftar sumber dana berhasil dimuat ulang.",
    fundSourceListLabel: "Daftar sumber dana",
    fundSourceRowLabel: "Sumber dana",
    undoIn: "Urungkan dalam",
    undoHint: "Tekan Enter untuk urungkan, Esc untuk tutup.",
    resetFilter: "Reset filter",
    filtersResetAll: "Filter direset. Semua sumber dana ditampilkan.",
    emptyFundSourceTitle: "Belum ada Sumber Dana",
    emptyFundSourceBody: "Buat Sumber Dana pertama Anda untuk mulai mencatat kantong dan saldo.",
    emptyTypeHint: "Pilih Jenis lalu isi nama Sumber Dana.",
  },
  en: {
    settingsEyebrow: "Configuration",
    settingsTitle: "Settings",
    notSignedIn: "Not signed in",
    profileNotLinked: "Profile not linked",
    signedInVia: "Signed in via",
    groupPreferences: "App Preferences",
    groupSecurity: "Security",
    groupData: "Data",
    language: "App Language",
    languageHint: "English · IDR",
    theme: "Appearance",
    themeOn: "Dark mode on",
    themeOff: "Light mode on",
    notifications: "Push Notifications",
    notificationsOn: "Transaction reminders on",
    notificationsOff: "Off",
    appLock: "App Lock / Biometrics",
    appLockOn: "On — verify on every launch",
    appLockOff: "Off",
    appLockNote: "Preview: device verification coming soon.",
    cloudSync: "Cloud Sync",
    cloudSyncOn: "Synced",
    cloudSyncOff: "Not synced yet",
    categories: "Transaction Categories",
    categoriesHint: "Manage categories",
    exportData: "Export Financial Data",
    exportHint: "Download report",
    logout: "Sign Out",
    deleteAccount: "Delete Account & Data",
    manage: "Manage",
    categoriesEmpty: "No categories yet. Add your own to get started.",
    addCategory: "Add Category",
    categoryName: "Category Name",
    categoryScope: "Applies To",
    allAccounts: "All accounts",
    income: "Income",
    expense: "Expense",
    save: "Save",
    cancel: "Cancel",
    close: "Close",
    delete: "Delete",
    invalidCategory: "Category name must be 2-24 characters and unique.",
    lockedTitle: "Wallet Locked",
    lockedBody: "Verify your identity to open the Wallet page.",
    unlock: "Unlock with Biometrics",
    accountHistory: "Account History",
    accountHistoryEmpty: "No transactions on this account yet.",
    rename: "Rename",
    renameCategory: "Rename Category",
    categoryInUse: "This category is used by transactions and cannot be deleted.",
    searchPlaceholder: "Search category or note",
    dateFrom: "From date",
    dateTo: "To date",
    resetFilters: "Reset filters",
    noResults: "No matching transactions.",
    categoryDeleted: "Category deleted",
    categoryRenamed: "Category renamed",
    searchCategories: "Search categories",
    sortLabel: "Sort",
    sortNameAsc: "Name (A-Z)",
    sortNameDesc: "Name (Z-A)",
    sortMostUsed: "Most used",
    noCategoryResults: "No categories match your search.",
    showAllCategories: "Show all",
    collapseCategories: "Collapse",
    fundSources: "Fund Sources",
    fundSourcesEmpty: "No fund sources yet. Add your own to get started.",
    addFundSource: "Add Fund Source",
    fundSourceName: "Fund Source Name",
    fundSourceType: "Type",
    fundSourceBalance: "Starting Balance",
    invalidFundSource: "Fund source name must be 3-24 characters and unique.",
    fundSourceHint: "Name must be 3-24 characters and unique.",
    saving: "Saving…",
    fundSourceInUse: "This fund source is still in use and cannot be deleted.",
    fundSourceAdded: "Fund source added",
    fundSourceRenamed: "Fund source renamed",
    fundSourceDeleted: "Fund source deleted",
    renameFundSource: "Rename Fund Source",
    searchFundSources: "Search fund sources",
    allTypes: "All types",
    noFundSourceResults: "No fund sources match your search.",
    confirmDeleteFundSourceTitle: "Delete fund source?",
    confirmDeleteFundSourceBody: "This fund source is unused. You can undo right after deleting.",
    confirmDelete: "Yes, delete",
    undo: "Undo",
    fundSourceRestored: "Fund source restored",
    fundSourceRestoreFailed: "Could not restore fund source.",
    fundSourceSaveFailed: "Could not save the fund source. Please try again.",
    fundSourceSaveFailedHint: "Your input has been kept in the form.",
    loadingFundSources: "Loading fund sources…",
    fundSourceLoadFailed: "Could not load the fund source list.",
    fundSourceLoadFailedHint: "Your data is safe. Check your connection and reload the list.",
    retryLoadFundSources: "Reload list",
    fundSourceReloaded: "Fund source list reloaded.",
    fundSourceListLabel: "Fund source list",
    fundSourceRowLabel: "Fund source",
    undoIn: "Undo in",
    undoHint: "Press Enter to undo, Esc to dismiss.",
    resetFilter: "Reset filter",
    filtersResetAll: "Filters reset. All fund sources are shown.",

    emptyFundSourceTitle: "No fund sources yet",
    emptyFundSourceBody: "Create your first fund source to start tracking pockets and balances.",
    emptyTypeHint: "Pick a type, then name the fund source.",
  },
};

export const t = (lang: Language): Dict => dictionaries[lang];
