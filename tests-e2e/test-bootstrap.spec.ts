import { test, expect } from '@playwright/test';
import { loginWithApiContext } from './helpers/login-as';
import { apiPath } from './helpers/api-url';
import { csrfHeaders } from './helpers/proof-run-api';
import { getAcademicBootstrap } from './helpers/automation-flow';

test('fetch bootstrap', async ({ request }) => {
  const { session } = await loginWithApiContext(request, 'course-leader')
  const bootstrap = await getAcademicBootstrap(request, session.csrfToken)
  console.log(Object.keys(bootstrap))
  if (bootstrap.questionPapersByOffering) {
    console.log('Keys of questionPapersByOffering:', Object.keys(bootstrap.questionPapersByOffering))
  }
});
