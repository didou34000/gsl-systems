import Image from 'next/image';
import {brandAssets} from '@/lib/brand';

type BrandLogoProps = {
  className?: string;
  eager?: boolean;
};

export default function BrandLogo({className, eager = false}: BrandLogoProps) {
  return (
    <Image
      className={['brand-logo', className].filter(Boolean).join(' ')}
      src={brandAssets.logo}
      alt="GSL systems"
      width={brandAssets.width}
      height={brandAssets.height}
      loading={eager ? 'eager' : 'lazy'}
      unoptimized
    />
  );
}
