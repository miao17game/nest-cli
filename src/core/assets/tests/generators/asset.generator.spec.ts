import {expect} from 'chai';
import * as sinon from 'sinon';
import {FileSystemUtils} from '../../../utils/file-system.utils';
import {Generator} from '../../../../common/asset/interfaces/generator.interface';
import {Asset} from '../../../../common/asset/interfaces/asset.interface';
import {AssetBuilder} from '../../builders/asset.builder';
import {TemplateBuilder} from '../../builders/template.builder';
import * as fs from 'fs';
import {PassThrough} from 'stream';
import * as path from 'path';
import {AssetGenerator} from '../../generators/asset.generator';

describe('AssetGenerator', () => {
  let sandbox: sinon.SinonSandbox;
  beforeEach(() => sandbox = sinon.sandbox.create());
  afterEach(() => sandbox.restore());

  let generator: Generator;
  beforeEach(() => generator = new AssetGenerator());

  let mkdirStub: sinon.SinonStub;
  let createReadStreamStub: sinon.SinonStub;
  let createWriteStreamStub: sinon.SinonStub;
  let pipeSpy: sinon.SinonSpy;
  beforeEach(() => {
    mkdirStub = sandbox.stub(FileSystemUtils, 'mkdir').callsFake(() => Promise.resolve());
    createReadStreamStub = sandbox.stub(fs, 'createReadStream').callsFake(() => {
      const reader = new PassThrough();
      reader.end();
      return reader;
    });
    createWriteStreamStub = sandbox.stub(fs, 'createWriteStream').callsFake(() => new PassThrough());
    pipeSpy = sandbox.spy(PassThrough.prototype, 'pipe');
  });

  describe('#generate()', () => {
    const asset: Asset = new AssetBuilder()
      .addFilename('asset-filename')
      .addClassName('className')
      .addTemplate(
        new TemplateBuilder()
          .addFilename('template-filename')
          .addReplacer({})
          .build()
      )
      .build();

    it('should generate the asset folder structure', () => {
      return generator.generate(asset)
        .then(() => {
          sinon.assert.calledWith(mkdirStub, path.dirname(path.relative(process.cwd(), asset.filename)));
        });
    });

    it('should open a read stream from the asset template filename', () => {
      return generator.generate(asset)
        .then(() => {
          sinon.assert.calledWith(createReadStreamStub, asset.template.filename);
        });
    });

    it('should open a write stream to the asset filename', () => {
      return generator.generate(asset)
        .then(() => {
          sinon.assert.calledWith(createWriteStreamStub, asset.filename);
        });
    });

    it('should pipe the read stream to the write stream by applying a reply transform', () => {
      return generator.generate(asset)
        .then(() => {
          sinon.assert.called(pipeSpy);
        });
    });

    it('should reject when an error occurred in the pipeline', () => {
      createReadStreamStub.callsFake(() => {
        const reader = new PassThrough();
        reader.emit('error', 'error message');
        return reader;
      });
      return generator.generate(asset)
        .then(() => {
          throw new Error('should not be here');
        })
        .catch(error => {
          expect(error.message).to.be.equal('Unhandled "error" event. (error message)');
        });
    });
  });
});
