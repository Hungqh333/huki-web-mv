import { Fragment } from 'react';

/**
 * Mã PC (hoặc một đoạn mã) chỉ được xuống dòng ngay sau dấu gạch nối — không bẻ giữa
 * một trường như "W1 / 1P". Dùng chung phông chữ của trang (Be Vietnam Pro, chốt 2026-11-04).
 */
export function PcCode({ text }: { text: string }) {
  const parts = text.split('-');
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 ? (
            <>
              -<wbr />
            </>
          ) : null}
        </Fragment>
      ))}
    </>
  );
}
