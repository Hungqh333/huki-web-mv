import { Fragment } from 'react';
import { configCodeMiddle, frameCodeHead, type PcConfigParts, type PcFrameKey } from '@/lib/pc/code';
import { PC_CODE_HEAD_CLASS, PC_CODE_MID_CLASS } from './styles';

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

/** Mã đầy đủ của một cấu hình: phần khung xám đậm, phần R-S-D in đậm (bảng Danh mục, thẻ Gợi ý). */
export function PcCodeParts({ frame, config }: { frame: PcFrameKey; config: PcConfigParts }) {
  return (
    <>
      <span className={PC_CODE_HEAD_CLASS}>
        <PcCode text={`${frameCodeHead(frame)}-`} />
      </span>
      <b className={PC_CODE_MID_CLASS}>
        <PcCode text={configCodeMiddle(frame, config)} />
      </b>
      <span className={PC_CODE_HEAD_CLASS}>-{frame.os}</span>
    </>
  );
}
