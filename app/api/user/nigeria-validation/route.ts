// app/api/user/nigeria-validation/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import dojahService from '@/lib/dojah-service';

export const dynamic = 'force-dynamic';

const getCurrentUserId = (): string | null => {
  const sessionCookie = cookies().get('session')?.value;
  if (!sessionCookie) return null;
  
  try {
    const session = JSON.parse(sessionCookie);
    return session.userId || null;
  } catch {
    return null;
  }
};


export async function POST(request: NextRequest) {
  try {
    const userId = getCurrentUserId();
    
    if (!userId) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { 
      bvn, 
      nin, 
      passportNumber, 
      surname, 
      driversLicense,
      firstName,
      lastName,
      dateOfBirth 
    } = body;
    
    const results: any = {};
    
    // Perform multiple validations if data is provided
    if (bvn) {
      try {
        results.bvn = await dojahService.lookupBVN(bvn, true);
      } catch (error) {
        results.bvn = { isMatch: false, error: 'BVN lookup failed' };
      }
    }
    
    if (nin) {
      try {
        results.nin = await dojahService.lookupNIN(nin);
      } catch (error) {
        results.nin = { isMatch: false, error: 'NIN lookup failed' };
      }
    }
    
    if (passportNumber && surname) {
      try {
        results.passport = await dojahService.lookupPassport(passportNumber, surname);
      } catch (error) {
        results.passport = { isMatch: false, error: 'Passport lookup failed' };
      }
    }
    
    if (driversLicense) {
      try {
        results.driversLicense = await dojahService.lookupDriversLicense(driversLicense);
      } catch (error) {
        results.driversLicense = { isMatch: false, error: 'Drivers license lookup failed' };
      }
    }
    
    // Perform AML screening if personal info is provided
    if (firstName && lastName) {
      try {
        results.aml = await dojahService.performAMLScreening({
          firstName,
          lastName,
          dateOfBirth,
          nationality: 'NG'
        });
      } catch (error) {
        results.aml = { error: 'AML screening failed' };
      }
    }
    
    // Calculate overall validation score
    const validations = Object.values(results).filter((r: any) => r.isMatch);
    const totalValidations = Object.keys(results).length;
    const validationScore = totalValidations > 0 ? (validations.length / totalValidations) * 100 : 0;
    
    return NextResponse.json({
      success: true,
      validationScore,
      results,
      summary: {
        totalChecks: totalValidations,
        passedChecks: validations.length,
        failedChecks: totalValidations - validations.length
      }
    });
  } catch (error: any) {
    console.error('NIGERIA_VALIDATION_ERROR', error);
    
    return new NextResponse(
      JSON.stringify({
        error: error.message || 'An error occurred during Nigeria validation',
      }),
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tin = searchParams.get('tin');
    const rcNumber = searchParams.get('rc_number');
    const companyType = searchParams.get('company_type');
    
    console.log('Received validation request with params:', {
      tin: tin || 'not provided',
      rcNumber: rcNumber || 'not provided',
      companyType: companyType || 'not provided'
    });

    let tinResult = null;
    let cacResult = null;
    let errors: any = {};

    // If both TIN and CAC params are present, validate both
    if (tin && rcNumber && companyType) {
      // Validate TIN
      console.log('Starting TIN validation for:', tin);
      try {
        tinResult = await dojahService.lookupFirsTin(tin);
        console.log('TIN validation result:', tinResult ? 'Success' : 'No result found');
        if (!tinResult) {
          errors.tin = 'No result found for provided TIN';
        }
      } catch (error: any) {
        console.error('TIN validation error:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        errors.tin = error.message || 'TIN validation failed';
      }
      // Validate CAC
      console.log('Starting CAC validation for:', rcNumber, companyType);
      try {
        cacResult = await dojahService.lookupCacBasic(rcNumber, companyType);
        console.log('CAC validation result:', cacResult ? 'Success' : 'No result found');
        if (!cacResult) {
          errors.cac = 'No result found for provided RC number and company type';
        }
      } catch (error: any) {
        console.error('CAC validation error:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        errors.cac = error.message || 'CAC validation failed';
      }
      if (Object.keys(errors).length > 0) {
        return NextResponse.json({ error: errors, tin: tinResult, cac: cacResult }, { status: 207 });
      }
      return NextResponse.json({ tin: tinResult, cac: cacResult });
    }

    // If only TIN is present
    if (tin) {
      console.log('Starting TIN validation for:', tin);
      try {
        const result = await dojahService.lookupFirsTin(tin);
        console.log('TIN validation result:', result ? 'Success' : 'No result found');
        if (!result) {
          return NextResponse.json({ error: 'No result found for provided TIN' }, { status: 404 });
        }
        return NextResponse.json({ entity: result });
      } catch (error: any) {
        console.error('TIN validation error:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        if (error.name === 'AbortError') {
          return NextResponse.json({ error: 'TIN validation timed out, please try again later.' }, { status: 504 });
        }
        return NextResponse.json({ error: error.message || 'TIN validation failed' }, { status: 502 });
      }
    }

    // If only CAC is present
    if (rcNumber && companyType) {
      console.log('Starting CAC validation for:', rcNumber, companyType);
      try {
        const result = await dojahService.lookupCacBasic(rcNumber, companyType);
        console.log('CAC validation result:', result ? 'Success' : 'No result found');
        if (!result) {
          return NextResponse.json({ error: 'No result found for provided RC number and company type' }, { status: 404 });
        }
        return NextResponse.json({ entity: result });
      } catch (error: any) {
        console.error('CAC validation error:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        if (error.name === 'AbortError') {
          return NextResponse.json({ error: 'CAC validation timed out, please try again later.' }, { status: 504 });
        }
        return NextResponse.json({ error: error.message || 'CAC validation failed' }, { status: 502 });
      }
    }

    return NextResponse.json({ error: 'Missing required parameters: either tin, or rc_number and company_type' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}