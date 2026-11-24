import * as repo from './repository.js';

export async function listDepartments() {
  return repo.listDepartments();
}

export async function createDepartment(body) {
  return repo.createDepartment(body);
}
