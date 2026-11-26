import React from 'react';
import { ImageResponse } from 'next/og';
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { SECTIONS_BY_CLASS, isValidClass } from '@/lib/constants';

export const runtime = 'nodejs';

function getSchoolLogoDataUri(): string {
  const logoPath = path.join(process.cwd(), 'public', 'school-logo-light.png');
  if (fs.existsSync(/*turbopackIgnore: true*/ logoPath)) {
    const base64 = fs
      .readFileSync(/*turbopackIgnore: true*/ logoPath)
      .toString('base64');
    return `data:image/png;base64,${base64}`;
  }
  return '';
}

export async function GET(req: NextRequest) {
  const clsParam = Number(req.nextUrl.searchParams.get('class'));
  const targetClass = isValidClass(clsParam) ? clsParam : null;
  const logoDataUri = getSchoolLogoDataUri();

  const eligibilityLabel = targetClass
    ? `Class ${targetClass}`
    : 'Cls 6–12';
  const eligibilitySub = targetClass
    ? targetClass >= 11
      ? SECTIONS_BY_CLASS[targetClass].join(', ')
      : `Section ${SECTIONS_BY_CLASS[targetClass].join(' & ')}`
    : 'Sec A/B & All Streams';

  const stats = [
    { label: 'FORMAT', value: '25 MCQs', sub: 'Randomized pool' },
    { label: 'DURATION', value: '30 Mins', sub: 'Online timed test' },
    { label: 'NEGATIVE MARK', value: 'Zero (0.00)', sub: 'Attempt every Q' },
    { label: 'ELIGIBILITY', value: eligibilityLabel, sub: eligibilitySub },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#FAF8F6',
          backgroundImage:
            'radial-gradient(circle at 1050px 80px, rgba(194, 89, 52, 0.14) 0%, rgba(194, 89, 52, 0) 45%), radial-gradient(circle at 120px 540px, rgba(46, 125, 91, 0.12) 0%, rgba(46, 125, 91, 0) 45%)',
          padding: '44px 56px',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '10px',
            background:
              'linear-gradient(90deg, #C25934 0%, #EA7A47 48%, #2E7D5B 100%)',
            display: 'flex',
          }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            marginTop: '6px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '22px',
              backgroundColor: '#FFFFFF',
              padding: '14px 26px',
              borderRadius: '24px',
              border: '1.5px solid #E2E8F0',
              boxShadow: '0 10px 25px rgba(15, 23, 42, 0.05)',
            }}
          >
            {logoDataUri ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoDataUri}
                alt="Maples Academy Khatauli Logo"
                width={210}
                height={115}
                style={{ objectFit: 'contain' }}
              />
            ) : null}
            <div
              style={{
                width: '2px',
                height: '68px',
                backgroundColor: '#E2E8F0',
                display: 'flex',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  color: '#0F172A',
                  letterSpacing: '-0.02em',
                }}
              >
                Maples Academy, Khatauli
              </span>
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 500,
                  color: '#64748B',
                  marginTop: '4px',
                }}
              >
                Distt. Muzaffarnagar, U.P. · Official Portal
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              padding: '14px 24px',
              borderRadius: '999px',
              fontSize: '18px',
              fontWeight: 700,
            }}
          >
            <div
              style={{
                width: '11px',
                height: '11px',
                borderRadius: '999px',
                backgroundColor: '#34D399',
                display: 'flex',
              }}
            />
            {targetClass ? `Class ${targetClass} Test` : 'Classes 6 to 12'}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: '8px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: '18px',
              fontWeight: 700,
              color: '#C25934',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            MAPLES TECH CLUB (MTC) · LEARN IT. BUILD IT. SHIP IT.
          </div>
          <div
            style={{
              fontSize: '54px',
              fontWeight: 800,
              color: '#0F172A',
              lineHeight: 1.08,
              letterSpacing: '-0.03em',
              marginTop: '8px',
              display: 'flex',
            }}
          >
            {targetClass
              ? `Class ${targetClass} Entrance Test Portal`
              : 'Online Entrance Test Portal'}
          </div>
          <div
            style={{
              fontSize: '23px',
              fontWeight: 400,
              color: '#475569',
              lineHeight: 1.4,
              marginTop: '10px',
              maxWidth: '980px',
              display: 'flex',
            }}
          >
            Practical everyday computer literacy quiz — shortcuts, hardware,
            apps, web &amp; cyber safety. No coding or syllabus prep needed.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'space-between',
            gap: '18px',
            width: '100%',
            marginTop: '8px',
          }}
        >
          {stats.map((stat) => (
            <div
              key={stat.label}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#FFFFFF',
                borderRadius: '18px',
                padding: '16px 22px',
                border: '1.5px solid #E2E8F0',
              }}
            >
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#C25934',
                  letterSpacing: '0.06em',
                }}
              >
                {stat.label}
              </span>
              <span
                style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  color: '#0F172A',
                  marginTop: '3px',
                }}
              >
                {stat.value}
              </span>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#64748B',
                  marginTop: '2px',
                }}
              >
                {stat.sub}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    }
  );
}
