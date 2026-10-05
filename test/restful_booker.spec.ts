import pactum from 'pactum';
import { StatusCodes } from 'http-status-codes';
import { SimpleReporter } from '../simple-reporter';
import { faker } from '@faker-js/faker';

describe('Restful-Booker API', () => {
  const p = pactum;
  const rep = SimpleReporter;
  const baseUrl = 'https://restful-booker.herokuapp.com';

  // Credenciais públicas da própria API (documentadas no site)
  const username = 'admin';
  const password = 'password123';

  let token = '';
  let bookingId = '';

  const gerarReserva = () => ({
    firstname: faker.person.firstName(),
    lastname: faker.person.lastName(),
    totalprice: faker.number.int({ min: 100, max: 1000 }),
    depositpaid: true,
    bookingdates: {
      checkin: '2026-11-01',
      checkout: '2026-11-10'
    },
    additionalneeds: 'Breakfast'
  });

  const reserva = gerarReserva();

  p.request.setDefaultTimeout(60000);
  p.request.setDefaultHeaders('Accept', 'application/json');

  beforeAll(() => {
    p.reporter.add(rep);
  });

  afterAll(() => p.reporter.end());

  beforeEach(async () => {
    token = await p
      .spec()
      .post(`${baseUrl}/auth`)
      .withJson({
        username: username,
        password: password
      })
      .expectStatus(StatusCodes.OK)
      .expectJsonSchema({
        type: 'object',
        properties: {
          token: { type: 'string' }
        },
        required: ['token']
      })
      .returns('token');
  });

  describe('Autenticação', () => {
    it('Login com credenciais inválidas', async () => {
      // A Restful-Booker retorna 200 com a mensagem "Bad credentials"
      await p
        .spec()
        .post(`${baseUrl}/auth`)
        .withJson({
          username: faker.internet.username(),
          password: faker.string.alphanumeric(8)
        })
        .expectStatus(StatusCodes.OK)
        .expectJson({ reason: 'Bad credentials' });
    });
  });

  describe('Reservas', () => {
    it('Cadastrar nova reserva', async () => {
      bookingId = await p
        .spec()
        .post(`${baseUrl}/booking`)
        .withJson(reserva)
        .expectStatus(StatusCodes.OK)
        .expectJsonSchema({
          type: 'object',
          properties: {
            bookingid: { type: 'number' },
            booking: { type: 'object' }
          },
          required: ['bookingid', 'booking']
        })
        .expectJsonLike({
          booking: {
            firstname: reserva.firstname,
            lastname: reserva.lastname,
            totalprice: reserva.totalprice
          }
        })
        .returns('bookingid');
    });

    it('Cadastrar reserva com payload inválido', async () => {
      // Sem os campos obrigatórios a API retorna erro de servidor (500)
      await p
        .spec()
        .post(`${baseUrl}/booking`)
        .withJson({
          firstname: faker.person.firstName()
        })
        .expectStatus(StatusCodes.INTERNAL_SERVER_ERROR);
    });

    it('Buscar a reserva cadastrada', async () => {
      await p
        .spec()
        .get(`${baseUrl}/booking/${bookingId}`)
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({
          firstname: reserva.firstname,
          lastname: reserva.lastname,
          totalprice: reserva.totalprice,
          depositpaid: true
        });
    });

    it('Buscar reserva com id inexistente', async () => {
      await p
        .spec()
        .get(`${baseUrl}/booking/0`)
        .expectStatus(StatusCodes.NOT_FOUND);
    });

    it('Editar reserva sem token', async () => {
      await p
        .spec()
        .put(`${baseUrl}/booking/${bookingId}`)
        .withJson(gerarReserva())
        .expectStatus(StatusCodes.FORBIDDEN);
    });

    it('Editar reserva completa (PUT)', async () => {
      const reservaEditada = gerarReserva();

      await p
        .spec()
        .put(`${baseUrl}/booking/${bookingId}`)
        .withHeaders('Cookie', `token=${token}`)
        .withJson(reservaEditada)
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({
          firstname: reservaEditada.firstname,
          lastname: reservaEditada.lastname,
          totalprice: reservaEditada.totalprice
        });
    });

    it('Editar reserva parcialmente (PATCH)', async () => {
      const novoNome = faker.person.firstName();

      await p
        .spec()
        .patch(`${baseUrl}/booking/${bookingId}`)
        .withHeaders('Cookie', `token=${token}`)
        .withJson({
          firstname: novoNome,
          totalprice: 999
        })
        .expectStatus(StatusCodes.OK)
        .expectJsonLike({
          firstname: novoNome,
          totalprice: 999
        });
    });

    it('Excluir reserva sem token', async () => {
      await p
        .spec()
        .delete(`${baseUrl}/booking/${bookingId}`)
        .expectStatus(StatusCodes.FORBIDDEN);
    });

    it('Excluir reserva', async () => {
      // A Restful-Booker retorna 201 no DELETE bem-sucedido
      await p
        .spec()
        .delete(`${baseUrl}/booking/${bookingId}`)
        .withHeaders('Cookie', `token=${token}`)
        .expectStatus(StatusCodes.CREATED);
    });

    it('Buscar reserva após a exclusão', async () => {
      await p
        .spec()
        .get(`${baseUrl}/booking/${bookingId}`)
        .expectStatus(StatusCodes.NOT_FOUND);
    });
  });
});
