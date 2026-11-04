/**
 * PC Vision — Checklist ổn định (gói bàn giao 03/11/2026 mục 5, tab 4; chữ theo mẫu đã duyệt `CK`).
 * Áp dụng cho MỌI PC trước khi giao. Chỉ hiển thị, không ghi nhận tick theo từng máy.
 * `required`: true = Bắt buộc (B), false = Khuyến nghị (K). Tiếng Anh: bản dịch đầu (Q8).
 */

export type ChecklistItem = { vi: string; en: string; required: boolean };
export type ChecklistGroup = { vi: string; en: string; items: ChecklistItem[] };

const B = true;
const K = false;

export const PC_CHECKLIST: ChecklistGroup[] = [
  {
    vi: 'Phần cứng',
    en: 'Hardware',
    items: [
      {
        vi: 'Máy dây chuyền 24/7: RAM + SSD hệ thống dòng I (mã có R…I và S…I); không trộn RAM khác lô / khác hãng',
        en: '24/7 line machines: industrial (I) RAM + system SSD (code has R…I and S…I); never mix RAM from different lots / brands',
        required: B,
      },
      {
        vi: 'RAM luôn 2 thanh cùng lô; dung lượng chốt lúc đặt hàng, không cắm thêm sau khi giao',
        en: 'RAM always 2 sticks from the same lot; capacity fixed at ordering, never added after delivery',
        required: B,
      },
      { vi: 'Ảnh lưu ở phân vùng riêng hoặc ổ dữ liệu, không lưu ổ C', en: 'Images go to a separate partition or data drive, never to drive C', required: B },
      {
        vi: 'Ổ dữ liệu dòng C trên dây chuyền 24/7: phần mềm không treo khi ổ lỗi/đầy; theo dõi SMART; chọn ổ TBW cao, không dùng QLC',
        en: 'Commercial (C) data drive on a 24/7 line: software must not hang when the drive fails/fills; monitor SMART; choose a high-TBW drive, no QLC',
        required: B,
      },
      { vi: 'Không dùng HDD trong tủ máy rung', en: 'No HDD in a vibrating cabinet', required: K },
      {
        vi: 'Card mạng camera chip Intel (i350/i210 GigE, X710/X550 10GigE); cố định card bằng giá chống rung',
        en: 'Camera network cards with Intel chips (i350/i210 GigE, X710/X550 10GigE); secure cards with an anti-vibration bracket',
        required: B,
      },
      {
        vi: 'Máy có GPU RTX 50: nguồn chuẩn ATX 3.1, dây 12V-2x6 nguyên bản từ nguồn, không dùng dây chuyển đổi',
        en: 'Machines with an RTX 50 GPU: ATX 3.1 PSU, native 12V-2x6 cable from the PSU, no adapter cables',
        required: B,
      },
      {
        vi: 'GPU: cắm chặt đầu nguồn 12V-2x6 tới khi khớp hẳn, không bẻ cáp gần đầu cắm',
        en: 'GPU: seat the 12V-2x6 connector fully until it locks, do not bend the cable near the connector',
        required: B,
      },
      { vi: 'UPS; nhiệt độ tủ ≤ 40°C, có lọc bụi', en: 'UPS; cabinet temperature ≤ 40°C, with dust filter', required: B },
    ],
  },
  {
    vi: 'BIOS',
    en: 'BIOS',
    items: [
      { vi: 'BIOS mới nhất có microcode Intel 0x12B trở lên (CPU đời 13/14)', en: 'Latest BIOS with Intel microcode 0x12B or newer (13th/14th gen CPUs)', required: B },
      { vi: 'Công suất mặc định Intel, không ép xung', en: 'Intel default power limits, no overclocking', required: B },
      { vi: 'Restore on AC Power Loss = Power On; bật watchdog nếu có', en: 'Restore on AC Power Loss = Power On; enable the watchdog if available', required: B },
      { vi: 'Tắt ASPM / PCIe power saving', en: 'Disable ASPM / PCIe power saving', required: B },
    ],
  },
  {
    vi: 'Windows',
    en: 'Windows',
    items: [
      { vi: 'Ưu tiên Windows IoT Enterprise LTSC', en: 'Prefer Windows IoT Enterprise LTSC', required: K },
      { vi: 'Win11 Pro: hoãn cập nhật, tắt tự khởi động lại', en: 'Win11 Pro: defer updates, disable automatic restart', required: B },
      {
        vi: 'Power plan High Performance; tắt Sleep, Hibernate, Fast Startup, USB selective suspend, PCIe Link State PM',
        en: 'High Performance power plan; disable Sleep, Hibernate, Fast Startup, USB selective suspend, PCIe Link State PM',
        required: B,
      },
      { vi: 'Loại trừ thư mục ảnh + phần mềm khỏi Defender quét', en: 'Exclude the image folders + software from Defender scans', required: B },
      { vi: 'Tự đăng nhập + phần mềm tự chạy; đồng bộ giờ NTP với PLC/MES', en: 'Auto log-on + software auto-start; NTP time sync with PLC/MES', required: B },
      {
        vi: 'Tự xoá ảnh xoay vòng: ảnh OK và ảnh NG giữ số ngày riêng; ổ đầy thì xoá ảnh cũ nhất',
        en: 'Rotating image cleanup: OK and NG images kept for separate numbers of days; when full, delete the oldest',
        required: B,
      },
    ],
  },
  {
    vi: 'Mạng camera',
    en: 'Camera network',
    items: [
      {
        vi: 'Mỗi cam 1 cổng, mỗi cổng 1 dải IP, IP tĩnh; không chung cổng với PLC/MES',
        en: 'One port per camera, one IP subnet per port, static IPs; never share a port with PLC/MES',
        required: B,
      },
      {
        vi: 'Jumbo frame 9000; Receive Buffers tối đa; tắt Energy Efficient Ethernet',
        en: 'Jumbo frame 9000; maximum Receive Buffers; disable Energy Efficient Ethernet',
        required: B,
      },
      { vi: 'Chỉ 1 filter driver của 1 hãng camera trên mỗi card', en: 'Only one camera vendor filter driver per card', required: B },
      { vi: 'Nhiều cam qua 1 switch: giới hạn băng thông từng cam', en: 'Several cameras through one switch: limit each camera bandwidth', required: B },
      { vi: 'USB3: tối đa 2 cam / 1 bộ điều khiển; cáp khoá vít', en: 'USB3: at most 2 cameras per controller; screw-locking cables', required: B },
    ],
  },
  {
    vi: 'GPU / phần mềm',
    en: 'GPU / software',
    items: [
      {
        vi: 'Cố định phiên bản driver NVIDIA (Studio), tắt tự cập nhật; ghi phiên bản CUDA/TensorRT',
        en: 'Pin the NVIDIA driver version (Studio), disable auto-update; record the CUDA/TensorRT versions',
        required: B,
      },
    ],
  },
  {
    vi: 'Đồng bộ & FAT',
    en: 'Standardization & FAT',
    items: [
      {
        vi: 'Mỗi khung có 1 bản ghi ổ đĩa chuẩn (image); các cấu hình cùng khung dùng chung image',
        en: 'Each frame has one standard disk image; configurations of the same frame share it',
        required: K,
      },
      {
        vi: 'Chạy thử 24h ở 100% trigger: mất khung = 0, RAM không tăng dần, CPU/GPU < 85°C',
        en: '24h test run at 100% trigger: zero lost frames, no creeping RAM use, CPU/GPU < 85°C',
        required: B,
      },
    ],
  },
];
